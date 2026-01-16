"use client";

import { useRef, useState, useEffect } from "react";
import PocketBase from "pocketbase";
import bcrypt from "bcryptjs";

// --------------------- CRYPTOGRAPHY UTILITIES (Web Crypto API) ---------------------
// Text Encoder for key derivation
const enc = new TextEncoder();

// Helper to convert ArrayBuffer to Base64 string for DB storage
function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))); 
}

const GEO_RADIUS_METERS = 500;

// Key Derivation Function (PBKDF2) - Derives a secure key from a passphrase
async function deriveKey(passphrase, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw", 
    enc.encode(passphrase), 
    { name: "PBKDF2" }, 
    false, 
    ["deriveKey"]
  ); 
  
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, 
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"] 
  );
}

export default function VaultLayout({ children, vaultName }) {
  const vaultId = vaultName; // vaultName is actually the vault ID
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showVaultSecurityModal, setShowVaultSecurityModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showGeolocationModal, setShowGeolocationModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [vault, setVault] = useState(null);
  const [vaultAccessGranted, setVaultAccessGranted] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [geoLat, setGeoLat] = useState("");
  const [geoLng, setGeoLng] = useState("");
  const [geoRadius, setGeoRadius] = useState(String(GEO_RADIUS_METERS));
  const [geoPassword, setGeoPassword] = useState("");
  const [unlockAt, setUnlockAt] = useState("");
  const [timePassword, setTimePassword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  const pb = new PocketBase("http://127.0.0.1:8090");

  const [user, setUser] = useState(pb.authStore.model);

  useEffect(() => {
    setUser(pb.authStore.model);
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(pb.authStore.model);
    });
    return () => unsubscribe();
  }, []);

  // Fetch vault details
  useEffect(() => {
    const fetchVault = async () => {
      if (!vaultId || !user?.id) return;

      try {
        const vaultData = await pb.collection("vaults").getOne(vaultId);
        setVault(vaultData);
        
        // Check if vault has security enabled
        if (vaultData.password_enabled || vaultData.geo_enabled || vaultData.time_enabled) {
          setVaultAccessGranted(false); // Require authentication
        } else {
          setVaultAccessGranted(true); // No security, grant access
        }
      } catch (err) {
        console.error("Failed to fetch vault:", err);
        setModalMessage("Failed to load vault details.");
      }
    };

    fetchVault();
  }, [vaultId, user?.id]);

  useEffect(() => {
    const fetchFiles = async () => {
      if (!user?.id || !vaultAccessGranted || !vaultId) return;

      try {
        const existingFiles = await pb.collection("file_info").getFullList({
          filter: `vault_id="${vaultId}"`,
        });

        const mappedFiles = existingFiles.map(f => ({
          id: f.id,
          collectionId: f.collectionId,
          file_name: f.file_name,
          file_type: f.file_type,
          uploaded: true,
          stored_file_name: f.file,
          is_encrypted: f.is_encrypted || false,
          salt: f.salt || "",
          iv: f.iv || "",
          url: f.file_type.startsWith("image/")
            ? `${pb.baseUrl}/api/files/${f.collectionId}/${f.id}/file/${f.file}`
            : null,
        }));

        setFiles(mappedFiles);
      } catch (err) {
        console.error("Failed to fetch files:", err);
        setModalMessage("Failed to load files. Check console.");
      }
    };

    fetchFiles();
  }, [user?.id, vaultAccessGranted, vaultId]);

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files).map(f => ({
      file: f,
      uploaded: false,
      file_name: f.name,
      file_type: f.type,
    }));
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const handleUpload = async () => {
    if (!user?.id) {
      setModalMessage("You must be logged in to upload files.");
      return;
    }

    setLoading(true);

    try {
      const updatedFiles = [...files];

      for (let i = 0; i < updatedFiles.length; i++) {
        const file = updatedFiles[i];
        if (file.uploaded) continue;

        const formData = new FormData();
        formData.append("file_name", file.file_name || "Unnamed File");
        formData.append("file_type", file.file_type || "unknown");
        formData.append("is_encrypted", false); 
        formData.append("salt", "");
        formData.append("iv", "");
        formData.append("encryption_id", "N/A"); 
        formData.append("encryption_key", "N/A");
        formData.append("vault_id", vaultId);
        formData.append("file", file.file);

        const createdFile = await pb.collection("file_info").create(formData);

        updatedFiles[i] = {
          ...file,
          uploaded: true,
          id: createdFile.id,
          collectionId: createdFile.collectionId,
          stored_file_name: createdFile.file,
          is_encrypted: false,
          url: file.file_type.startsWith("image/")
            ? `${pb.baseUrl}/api/files/${createdFile.collectionId}/${createdFile.id}/${createdFile.file_name}`
            : null,
        };
      }

      setFiles(updatedFiles);
      setModalMessage("✅ Files successfully added to storage!");
    } catch (err) {
      console.error("Upload error:", err);
      setModalMessage("Upload failed. Check console.");
    } finally {
      setLoading(false);
    }
  };

  // Security validation functions
  const validatePassword = async (inputPassword) => {
    if (!vault?.password_hash) return false;
    return await bcrypt.compare(inputPassword, vault.password_hash);
  };

  const validateGeolocation = () => {
    if (!vault?.geo_enabled) return true;
    
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          const vaultLat = vault.geo_lat;
          const vaultLng = vault.geo_lng;
          const radius = vault.geo_radius || GEO_RADIUS_METERS;

          // Calculate distance using Haversine formula
          const R = 6371e3; // Earth's radius in meters
          const φ1 = userLat * Math.PI / 180;
          const φ2 = vaultLat * Math.PI / 180;
          const Δφ = (vaultLat - userLat) * Math.PI / 180;
          const Δλ = (vaultLng - userLng) * Math.PI / 180;

          const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ/2) * Math.sin(Δλ/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

          const distance = R * c;
          resolve(distance <= radius);
        },
        () => resolve(false)
      );
    });
  };

  const handleMapSelection = async (lat, lng) => {
    setGeoLat(lat.toFixed(6));
    setGeoLng(lng.toFixed(6));
    setGeoRadius(String(GEO_RADIUS_METERS));

    if (!mapRef.current) return;

    try {
      const L = (await import("leaflet")).default;

      // Update or create marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
      }

      // Update or create circle
      if (circleRef.current) {
        circleRef.current.setLatLng([lat, lng]);
      } else {
        circleRef.current = L.circle([lat, lng], {
          radius: GEO_RADIUS_METERS,
          color: "#e50914",
          fillColor: "#e50914",
          fillOpacity: 0.15,
        }).addTo(mapRef.current);
      }

      mapRef.current.setView([lat, lng], 15);
    } catch (err) {
      console.error("Error updating map:", err);
    }
  };

  const fillCurrentLocation = () => {
    if (!navigator.geolocation) {
      setModalMessage("❌ Geolocation is not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        handleMapSelection(latitude, longitude);
      },
      () => setModalMessage("❌ Unable to fetch current location."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const results = await response.json();

      if (results.length > 0) {
        const { lat, lon } = results[0];
        handleMapSelection(parseFloat(lat), parseFloat(lon));
      } else {
        setModalMessage("❌ Location not found. Try another search.");
      }
    } catch (err) {
      console.error("Search error:", err);
      setModalMessage("❌ Search failed. Please try again.");
    }
  };

  const checkVaultAccess = async () => {
    if (!vault) return false;

    // Time gate check first
    if (vault.time_enabled) {
      const now = new Date();
      const unlockTime = vault.unlock_at ? new Date(vault.unlock_at) : null;

      if (!unlockTime || Number.isNaN(unlockTime.getTime())) {
        setModalMessage("❌ Unlock time is not set correctly.");
        return false;
      }

      if (now < unlockTime) {
        setModalMessage(`⏳ Available after ${unlockTime.toLocaleString()}`);
        return false;
      }
    }

    // Location check
    if (vault.geo_enabled) {
      const geoValid = await validateGeolocation();
      if (!geoValid) {
        setModalMessage("❌ Location requirement not met.");
        return false;
      }
    }

    // Password is always required when enabled
    if (vault.password_enabled) {
      const inputPassword = prompt("Enter vault password:");
      if (!inputPassword) return false;
      const passwordValid = await validatePassword(inputPassword);
      if (!passwordValid) {
        setModalMessage("❌ Incorrect password.");
      }
      return passwordValid;
    }

    return true;
  };

  // Security modal handlers
  const handlePasswordSecurity = async () => {
    const password = prompt("Set a password for this vault:");
    if (!password) return;

    try {
      const hashedPassword = await bcrypt.hash(password, 12);
      
      await pb.collection("vaults").update(vaultId, {
        password_enabled: true,
        password_hash: hashedPassword,
        geo_enabled: false,
        geo_lat: null,
        geo_lng: null,
        geo_radius: null,
        time_enabled: false,
        unlock_at: null,
      });

      setVault(prev => ({ 
        ...prev, 
        password_enabled: true, 
        password_hash: hashedPassword,
        geo_enabled: false,
        geo_lat: null,
        geo_lng: null,
        geo_radius: null,
        time_enabled: false,
        unlock_at: null,
      }));
      setModalMessage("✅ Password security enabled!");
      setShowVaultSecurityModal(false);
    } catch (err) {
      console.error("Failed to set password:", err);
      setModalMessage("❌ Failed to set password security.");
    }
  };

  const handleGeolocationSecurity = async () => {
    setShowVaultSecurityModal(false);
    setShowGeolocationModal(true);
    setShowTimeModal(false);
  };

  const handleTimeSecurity = () => {
    setShowVaultSecurityModal(false);
    setShowTimeModal(true);
    setShowGeolocationModal(false);
  };

  const saveGeolocationSecurity = async () => {
    const lat = parseFloat(geoLat);
    const lng = parseFloat(geoLng);
    const radius = GEO_RADIUS_METERS;

    if (!geoPassword) {
      setModalMessage("❌ Please enter a password for this vault.");
      return;
    }

    if (isNaN(lat) || isNaN(lng)) {
      setModalMessage("❌ Please pick a location on the map.");
      return;
    }

    try {
      const hashedPassword = await bcrypt.hash(geoPassword, 12);

      await pb.collection("vaults").update(vaultId, {
        geo_enabled: true,
        geo_lat: lat,
        geo_lng: lng,
        geo_radius: radius,
        time_enabled: false,
        unlock_at: null,
        password_enabled: true,
        password_hash: hashedPassword,
      });

      setVault(prev => ({ 
        ...prev, 
        geo_enabled: true, 
        geo_lat: lat, 
        geo_lng: lng, 
        geo_radius: radius,
        time_enabled: false,
        unlock_at: null,
        password_enabled: true,
        password_hash: hashedPassword,
      }));
      
      setModalMessage("✅ Geolocation security enabled!");
      setShowGeolocationModal(false);
      setGeoLat("");
      setGeoLng("");
      setGeoRadius(String(GEO_RADIUS_METERS));
      setGeoPassword("");
    } catch (err) {
      console.error("Failed to set geolocation:", err);
      setModalMessage("❌ Failed to set geolocation security.");
    }
  };

  const saveTimeSecurity = async () => {
    if (!unlockAt) {
      setModalMessage("❌ Please select an unlock date and time.");
      return;
    }

    if (!timePassword) {
      setModalMessage("❌ Please enter a password for this vault.");
      return;
    }

    const unlockDate = new Date(unlockAt);

    if (Number.isNaN(unlockDate.getTime())) {
      setModalMessage("❌ Invalid unlock date/time.");
      return;
    }

    try {
      const hashedPassword = await bcrypt.hash(timePassword, 12);

      await pb.collection("vaults").update(vaultId, {
        time_enabled: true,
        unlock_at: unlockDate.toISOString(),
        geo_enabled: false,
        geo_lat: null,
        geo_lng: null,
        geo_radius: null,
        password_enabled: true,
        password_hash: hashedPassword,
      });

      setVault(prev => ({
        ...prev,
        time_enabled: true,
        unlock_at: unlockDate.toISOString(),
        geo_enabled: false,
        geo_lat: null,
        geo_lng: null,
        geo_radius: null,
        password_enabled: true,
        password_hash: hashedPassword,
      }));

      setModalMessage("✅ Time lock enabled. Vault opens after the scheduled time with password.");
      setShowTimeModal(false);
      setUnlockAt("");
      setTimePassword("");
    } catch (err) {
      console.error("Failed to set time security:", err);
      setModalMessage("❌ Failed to set time security.");
    }
  };

  // Initialize Leaflet map when modal opens
  useEffect(() => {
    if (!showGeolocationModal) {
      // Clean up map when modal closes
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
      return;
    }

    // Don't reinitialize if map already exists
    if (mapRef.current) return;

    // Delay map creation to ensure DOM is ready
    const initMap = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");

        // Fix default marker icon
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        // Create map
        const map = L.map("geo-map", {
          center: [20, 0],
          zoom: 2,
        });

        // Add tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        // Add click handler
        map.on("click", (e) => {
          handleMapSelection(e.latlng.lat, e.latlng.lng);
        });

        mapRef.current = map;

        // Try to get user's current location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              handleMapSelection(latitude, longitude);
            },
            () => {},
            { enableHighAccuracy: true, timeout: 6000 }
          );
        }
      } catch (err) {
        console.error("Map initialization error:", err);
      }
    };

    setTimeout(initMap, 100);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
  }, [showGeolocationModal]);

  // Check access on component mount if security is enabled
  useEffect(() => {
    const checkAccess = async () => {
      if (vault && (vault.password_enabled || vault.geo_enabled) && !vaultAccessGranted) {
        const accessGranted = await checkVaultAccess();
        setVaultAccessGranted(accessGranted);
        
        if (!accessGranted) {
          setModalMessage("❌ Access denied. Security validation failed.");
        }
      }
    };

    checkAccess();
  }, [vault]);

  return (
    <div style={styles.page}>
      <header style={styles.topbar}>
        <div style={styles.vaultName}>{vault?.name || vaultId}</div>
        <button style={styles.profileBtn}>Profile</button>
      </header>

      <section style={styles.bigSlot}>
        <div
          style={styles.fileGrid}
          onClick={(e) => {
            if (e.target === e.currentTarget && vaultAccessGranted) {
              fileInputRef.current?.click();
            }
          }}
        >
          {!vaultAccessGranted ? (
            <div style={styles.accessDenied}>
              <div style={styles.lockIcon}>🔒</div>
              <div style={styles.accessText}>Vault Access Required</div>
              <button 
                style={styles.unlockBtn} 
                onClick={async () => {
                  const accessGranted = await checkVaultAccess();
                  setVaultAccessGranted(accessGranted);
                  if (!accessGranted) {
                    setModalMessage("❌ Access denied. Security validation failed.");
                  }
                }}
              >
                Unlock Vault
              </button>
            </div>
          ) : files.length === 0 ? (
            <div style={styles.uploadContent}>
              <div style={styles.arrow}>↑</div>
              <div style={styles.uploadText}>Click to Add Files</div>
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                style={styles.fileCard}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(file);
                }}
              >
                {file.file_type?.startsWith("image/") ? (
                  <img
                    src={file.uploaded ? file.url : URL.createObjectURL(file.file)}
                    alt={file.file_name}
                    style={styles.filePreview}
                  />
                ) : (
                  <div style={styles.fileIcon}>📄</div>
                )}
                <div style={styles.fileName}>{file.file_name}</div>
              </div>
            ))
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
          multiple
        />
      </section>

      {files.length > 0 && (
        <div style={styles.uploadBtnWrapper}>
          <button style={styles.uploadBtn} onClick={handleUpload} disabled={loading}>
            {loading ? "Uploading..." : "Add Files to Storage"}
          </button>
        </div>
      )}

      <main style={styles.main}>{children}</main>

      {selectedFile && (
        <div
          style={styles.fileModalOverlay}
          onClick={() => setSelectedFile(null)}
        >
          <div
            style={styles.fileModalContent}
            onClick={(e) => e.stopPropagation()}
          >
            {selectedFile.file_type?.startsWith("image/") ? (
              <img
                src={selectedFile.url}
                alt={selectedFile.file_name}
                style={styles.modalImage}
              />
            ) : (
              <div style={styles.modalFileIcon}>📄</div>
            )}
            <div style={styles.modalFileName}>{selectedFile.file_name}</div>
          </div>

          {/* Floating Buttons */}
          <button
            style={{ ...styles.modalBtn, left: "40px" }}
            onClick={() => handleEncrypt(selectedFile)}
          >
            {selectedFile?.is_encrypted ? "Encrypted" : "Encrypt"}
          </button>
          <button
            style={{ ...styles.modalBtn, right: "40px" }}
            onClick={async () => {
              if (!selectedFile?.id) return;

              // NEW: Prevent download if file is encrypted
              if (selectedFile?.is_encrypted) {
                setModalMessage(
                  `❌ The file '${selectedFile.file_name}' is encrypted and cannot be downloaded.`
                );
                return;
              }

              try {
                // CORRECT DOWNLOAD URL (using collection ID and stored file name)
                const fileUrl = `${pb.baseUrl}/api/files/${selectedFile.collectionId}/${selectedFile.id}/${encodeURIComponent(selectedFile.stored_file_name)}?download=1`;

                const a = document.createElement("a");
                a.href = fileUrl;
                a.download = selectedFile.file_name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              } catch (error) {
                console.error("Download failed:", error);
                setModalMessage("❌ Download failed. Please try again.");
              }
            }}
          >
            Download
          </button>
        </div>
      )}

      {modalMessage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
          }}
          onClick={() => setModalMessage("")} // dismiss when clicking outside
        >
          <div
            style={{
              background: "#1a1a1a",
              padding: "24px 32px",
              borderRadius: "12px",
              boxShadow: "0 0 20px rgba(229,9,20,0.5)",
              maxWidth: "90%",
              textAlign: "center",
              color: "white",
            }}
            onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
          >
            <p style={{ marginBottom: "20px", fontSize: "16px" }}>{modalMessage}</p>
            <button
              style={{
                padding: "10px 20px",
                borderRadius: "999px",
                border: "none",
                background: "#e50914",
                color: "white",
                fontWeight: "600",
                cursor: "pointer",
                boxShadow: "0 0 10px rgba(229,9,20,0.4)",
              }}
              onClick={() => setModalMessage("")}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Add Vault Security Button (Right-Bottom Corner) */}
      <button
        style={styles.addVaultBtn}
        onClick={() => setShowVaultSecurityModal(true)}
      >
        Configure Vault Security
      </button>

      {/* Vault Security Modal */}
      {showVaultSecurityModal && (
        <div
          style={styles.modalOverlay}
          onClick={() => setShowVaultSecurityModal(false)}
        >
          <div style={styles.vaultModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "#e50914", marginBottom: "20px" }}>Vault Security Options</h3>
            <button style={styles.vaultOptionBtn} onClick={handleTimeSecurity}>
              Time Lock + Password
            </button>
            <button style={styles.vaultOptionBtn} onClick={handleGeolocationSecurity}>
              Location Lock + Password
            </button>
            <button style={styles.vaultOptionBtn} onClick={handlePasswordSecurity}>
              Password Only
            </button>
          </div>
        </div>
      )}

      {/* Time Security Modal */}
      {showTimeModal && (
        <div
          style={styles.modalOverlay}
          onClick={() => setShowTimeModal(false)}
        >
          <div style={styles.geoModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "#e50914", marginBottom: "20px" }}>Schedule Unlock Time</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              <input
                type="datetime-local"
                value={unlockAt}
                onChange={(e) => setUnlockAt(e.target.value)}
                style={styles.inputField}
              />
              <input
                type="password"
                placeholder="Password required at unlock"
                value={timePassword}
                onChange={(e) => setTimePassword(e.target.value)}
                style={styles.inputField}
              />
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "20px" }}>
                <button style={styles.saveBtn} onClick={saveTimeSecurity}>
                  Save
                </button>
                <button style={styles.cancelBtn} onClick={() => setShowTimeModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Geolocation Security Modal */}
      {showGeolocationModal && (
        <div
          style={styles.modalOverlay}
          onClick={() => setShowGeolocationModal(false)}
        >
          <div style={styles.geoModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "#e50914", marginBottom: "20px" }}>Set Geolocation Security</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              <div style={styles.mapHint}>Search or click on the map to set the vault location (500m radius enforced).</div>
              
              {/* Search Box */}
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  style={{ ...styles.inputField, flex: 1 }}
                  placeholder="Search location (e.g., New York, USA)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button style={styles.saveBtn} onClick={handleSearch}>
                  Search
                </button>
              </div>

              {/* Leaflet Map */}
              <div id="geo-map" style={styles.mapContainer} />
              
              <div style={styles.coordsRow}>
                <span>Lat: {geoLat || "-"}</span>
                <span>Lng: {geoLng || "-"}</span>
                <span>Radius: {geoRadius || GEO_RADIUS_METERS} m</span>
                <button style={styles.secondaryBtn} onClick={fillCurrentLocation}>
                  Use Current Location
                </button>
              </div>
              <input
                type="password"
                placeholder="Password required at unlock"
                value={geoPassword}
                onChange={(e) => setGeoPassword(e.target.value)}
                style={styles.inputField}
              />
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "20px" }}>
                <button style={styles.saveBtn} onClick={saveGeolocationSecurity}>
                  Save
                </button>
                <button style={styles.cancelBtn} onClick={() => setShowGeolocationModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------- Styles ---------------------
const styles = {
  page: { minHeight: "100vh", background: "black", color: "white", display: "flex", justifyContent: "center", flexDirection: "column", padding: "24px", boxSizing: "border-box" },
  topbar: { width: "100%", maxWidth: "1800px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px", paddingLeft: "24px", paddingRight: "0px", margin: "0 auto", boxSizing: "border-box" },
  vaultName: { fontFamily: "'Orbitron', sans-serif", fontSize: "28px", fontWeight: "bold", color: "#e50914", letterSpacing: "0.5px" },
  profileBtn: { fontSize: "14px", padding: "8px 12px", background: "#1a1a1a", border: "1px solid rgba(229,9,20,0.45)", borderRadius: "999px", color: "white", cursor: "pointer", boxShadow: "0 0 10px rgba(229,9,20,0.25)" },
  bigSlot: { width: "100%", maxWidth: "1500px", minHeight: "300px", flex: 1, background: "#1a1a1a", border: "1px solid rgba(229,9,20,0.45)", borderRadius: "12px", padding: "20px", margin: "0 auto 32px", boxShadow: "0 0 14px rgba(229,9,20,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", cursor: "crosshair", transition: "all 0.2s ease" },
  uploadContent: { textAlign: "center" },
  arrow: { fontSize: "48px", color: "#e50914", marginBottom: "12px" },
  uploadText: { fontSize: "18px", fontWeight: "600", color: "#ccc" },
  fileGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "16px", width: "100%" },
  fileCard: { background: "#2a2a2a", borderRadius: "8px", padding: "10px", textAlign: "center", color: "white", fontSize: "14px", wordBreak: "break-word", cursor: "zoom-in" },
  filePreview: { width: "100%", height: "100px", objectFit: "cover", borderRadius: "6px", marginBottom: "8px" },
  fileIcon: { fontSize: "40px", marginBottom: "8px" },
  fileName: { fontSize: "12px", color: "#ccc" },
  uploadBtnWrapper: { display: "flex", justifyContent: "center", marginBottom: "24px" },
  uploadBtn: { padding: "12px 20px", background: "#e50914", border: "none", borderRadius: "999px", color: "white", fontSize: "16px", fontWeight: "600", cursor: "pointer", boxShadow: "0 0 10px rgba(229,9,20,0.4)" },
  fileModalOverlay: { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  fileModalContent: { position: "relative", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: "#1a1a1a", borderRadius: "12px", padding: "20px", maxWidth: "80%", maxHeight: "80%", overflow: "hidden" },
  modalImage: { maxWidth: "100%", maxHeight: "400px", marginBottom: "16px", borderRadius: "8px" },
  modalFileIcon: { fontSize: "80px", marginBottom: "16px" },
  modalFileName: { fontSize: "18px", color: "#ccc", marginBottom: "24px" },
  modalBtn: { position: "fixed", top: "50%", transform: "translateY(-50%)", padding: "12px 20px", background: "#e50914", border: "none", borderRadius: "999px", color: "white", cursor: "pointer", fontWeight: "600", zIndex: 10000 }, 
  addVaultBtn: {position: "absolute", bottom: "20px", right:"20px",padding: "10px 16px", background: "#e50914", border: "none", borderRadius: "999px", color: "white",fontWeight: "600", cursor: "pointer", boxShadow: "0 0 10px rgba(229,9,20,0.4)", zIndex: 5000,},
  vaultModal: {background: "#1a1a1a", padding: "24px", borderRadius: "12px", display: "flex",flexDirection: "column", alignItems: "center", gap: "16px",},
  vaultOptionBtn: {padding: "12px 20px",background: "#e50914", border: "none", borderRadius: "999px", color: "white", fontWeight: "600",cursor: "pointer", width: "220px",},
  modalOverlay: { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 },
  geoModal: {background: "#1a1a1a", padding: "24px", borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", minWidth: "300px"},
  mapContainer: { width: "100%", height: "320px", borderRadius: "12px", overflow: "hidden", border: "1px solid #333" },
  mapHint: { fontSize: "13px", color: "#aaa" },
  coordsRow: { display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "space-between", fontSize: "13px", color: "#ccc" },
  inputField: {padding: "10px", borderRadius: "6px", border: "1px solid #333", background: "#2a2a2a", color: "white", width: "100%", boxSizing: "border-box"},
  secondaryBtn: {padding: "10px 12px", background: "#222", border: "1px solid #444", borderRadius: "8px", color: "white", fontWeight: "600", cursor: "pointer"},
  saveBtn: {padding: "10px 20px", background: "#e50914", border: "none", borderRadius: "999px", color: "white", fontWeight: "600", cursor: "pointer"},
  cancelBtn: {padding: "10px 20px", background: "#666", border: "none", borderRadius: "999px", color: "white", fontWeight: "600", cursor: "pointer"},
  accessDenied: { display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "#eee" },
  lockIcon: { fontSize: "46px" },
  accessText: { fontSize: "18px", fontWeight: "600" },
  unlockBtn: { padding: "10px 18px", background: "#e50914", border: "none", borderRadius: "10px", color: "white", fontWeight: "700", cursor: "pointer", boxShadow: "0 0 10px rgba(229,9,20,0.35)" },
};
