'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PocketBase from 'pocketbase';
import VaultLayout from '../components/vaultLayout';
import { getAvatarSeed, getAvatarStyle, getAvatarUrl } from '../lib/avatar';

const pb = new PocketBase('http://127.0.0.1:8090');

export default function VaultsPage() {
  const router = useRouter();
  const [vaults, setVaults] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [draggedVault, setDraggedVault] = useState(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [hoveredSlot, setHoveredSlot] = useState(null);

  const [displayName, setDisplayName] = useState('Guest');
  const [user, setUser] = useState(pb.authStore.model || null);
  const avatarUrl = getAvatarUrl(getAvatarStyle(user), getAvatarSeed(user));

  const handlePocketBaseError = (err, fallbackMessage) => {
    const status = err?.status;
    const msg = String(err?.message || '');

    if (status === 401 || status === 403) {
      pb.authStore.clear();
      setUser(null);
      router.push('/auth');
      return;
    }

    if (status === 0 || msg.toLowerCase().includes('failed to fetch')) {
      setModalMessage('Cannot connect to PocketBase. Please make sure backend is running.');
      return;
    }

    if (fallbackMessage) {
      setModalMessage(fallbackMessage);
    }
  };

  useEffect(() => {
    if (user) {
      const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      setDisplayName(full || user.email || 'User');
    } else {
      setDisplayName('Guest');
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(pb.authStore.model || null);
    });

    const refreshUser = async () => {
      const current = pb.authStore.model;
      if (!current?.id || !pb.authStore.token) return;

      try {
        const latest = await pb.collection('users').getOne(current.id);
        pb.authStore.save(pb.authStore.token, latest);
        setUser(latest);
      } catch (err) {
        handlePocketBaseError(err, 'Failed to refresh profile data.');
      }
    };

    refreshUser();
    return () => unsubscribe();
  }, []);

  // ----------------------------
  // Fetch vaults from PocketBase
  // ----------------------------
  useEffect(() => {
    const fetchVaults = async () => {
      if (!user?.id) return;

      try {
        const existingVaults = await pb.collection("vaults").getFullList({
          filter: `owner="${user.id}"`,
        });

        const loadedVaults = existingVaults.map((v) => ({
          id: v.id,
          title: v.name,
          type: v.type,
          color: '#2d6cdf',
          registered: true,
        }));

        const loadedVaultsWithSlots = [...loadedVaults];
        while (loadedVaultsWithSlots.length < 4) {
          loadedVaultsWithSlots.push(null);
        }

        setVaults(loadedVaultsWithSlots);
      } catch (err) {
        handlePocketBaseError(err, 'Failed to load vaults.');
      }
    };

    fetchVaults();
  }, [user?.id]);

  const vaultTypes = ['Personal Vault', 'Evidence Vault', 'Government Vault', 'Research Vault'];

  const handleMouseMove = (e) => {
    if (draggedVault) {
      setDragPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleDrop = (index) => {
    if (draggedVault !== null) {
      const newVault = {
        id: crypto.randomUUID(),
        title: draggedVault,
        type: draggedVault,
        color: '#2d6cdf',
        registered: false,
      };
      setVaults((prev) => {
        const copy = [...prev];
        copy[index] = newVault;
        return copy;
      });
      setDraggedVault(null);
      setHoveredSlot(null);
    }
  };

  // ----------------------------
  // Register vaults in PocketBase
  // ----------------------------
  const handleRegisterVaults = async () => {
    if (!user) {
      setModalMessage("You must be logged in to register vaults.");
      return;
    }

    try {
      const existingVaults = await pb.collection("vaults").getFullList({
        filter: `owner="${user.id}"`,
      });

      const existingTypes = existingVaults.map((v) => v.type);

      const toCreate = vaults.filter((v) => v && !v.registered && !existingTypes.includes(v.type));

      if (toCreate.length === 0) {
        setModalMessage("Cannot create duplicate vaults.");
        return;
      }

      for (const v of toCreate) {
        const created = await pb.collection("vaults").create({
          name: v.title,
          type: v.type,
          owner: user.id,
        });

        setVaults((prev) =>
          prev.map((vault) =>
            vault && vault.type === v.type
              ? { ...vault, id: created.id, registered: true }
              : vault
          )
        );
      }

      setModalMessage("Vaults registered successfully!");
    } catch (err) {
      console.error(err);
      setModalMessage("Failed to register vaults.");
    }
  };

  const handleDeleteVault = async (vault, index) => {
    if (!user?.id) {
      setModalMessage("You must be logged in to delete vaults.");
      return;
    }

    if (!vault?.registered || !vault?.id) return;

    const shouldDelete = window.confirm(
      `Delete vault '${vault.title}' and all files inside it? This cannot be undone.`
    );
    if (!shouldDelete) return;

    try {
      const linkedFiles = await pb.collection("file_info").getFullList({
        filter: `vault_id="${vault.id}"`,
      });

      for (const fileRecord of linkedFiles) {
        await pb.collection("file_info").delete(fileRecord.id);
      }

      await pb.collection("vaults").delete(vault.id);

      setVaults((prev) => {
        const copy = [...prev];
        copy[index] = null;
        return copy;
      });

      setModalMessage("Vault and all files deleted successfully.");
    } catch (err) {
      console.error("Failed to delete vault:", err);
      setModalMessage("Failed to delete vault. Please try again.");
    }
  };

  return (
    <div
      style={styles.page}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setDraggedVault(null)}
    >
      {/* Top Bar */}
      <div style={styles.topbar}>
        <div style={styles.userBox}>{displayName}</div>
        <div style={styles.brand}>RedBox</div>
        <button style={styles.profilePill} onClick={() => router.push('/profile')}>
          <img src={avatarUrl} alt="Profile" style={styles.profileAvatar} />
        </button>
      </div>

      {/* Horizontal Vault Section */}
      <div style={styles.horizontalSection}>
        {vaultTypes.map((label) => (
          <div
            key={label}
            style={styles.hCard}
            onDoubleClick={() => setDraggedVault(label)}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        <div style={styles.vaultRow}>
          {[0, 1, 2, 3].map((i) => {
            const vault = vaults[i];
            const isHovered = hoveredSlot === i;

            return (
              <div
                key={i}
                style={{
                  ...styles.vaultSlot,
                  borderColor: isHovered ? '#e50914' : styles.vaultSlot.border,
                  transform: isHovered && draggedVault ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.2s, border-color 0.2s',
                  position: 'relative',
                  cursor: vault?.registered ? 'pointer' : 'default',
                }}
                onMouseEnter={() => setHoveredSlot(i)}
                onMouseLeave={() => hoveredSlot === i && setHoveredSlot(null)}
                onMouseUp={() => handleDrop(i)}
                onClick={() => {
                  if (vault?.registered && !vault.editing) {
                    window.location.href = `/vault/${vault.id}`;
                  }
                }}
              >
                {vault ? (
                  vault.editing ? (
                    <input
                      autoFocus
                      defaultValue={vault.title}
                      onBlur={(e) => {
                        setVaults((prev) => {
                          const copy = [...prev];
                          copy[i] = { ...copy[i], title: e.target.value, editing: false };
                          return copy;
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                      }}
                      style={{
                        width: '90%',
                        padding: '4px 6px',
                        borderRadius: '6px',
                        border: '1px solid #e50914',
                        background: '#1a1a1a',
                        color: 'white',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    />
                  ) : (
                    <div
                      style={{ textAlign: 'center', fontWeight: '600' }}
                      onDoubleClick={() => {
                        setVaults((prev) => {
                          const copy = [...prev];
                          copy[i] = { ...copy[i], editing: true };
                          return copy;
                        });
                      }}
                    >
                      {vault.registered && (
                        <button
                          style={styles.deleteVaultBtn}
                          aria-label={`Delete ${vault.title}`}
                          title="Delete vault"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVault(vault, i);
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M3 6h18M9 6V4h6v2m-8 0l1 14h8l1-14"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      )}
                      {vault.title}

                      {/* Tooltip on hover */}
                      {isHovered && vault.registered && !vault.editing && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '10px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#e50914',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                          }}
                        >
                          Click to open vault
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <>
                    <svg
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      style={styles.plusIcon}
                      aria-hidden="true"
                    >
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div style={styles.slotText}>Create new vaults</div>
                  </>
                )}
              </div>
            );
          })}

          {/* Extra Slot */}
          <div
            style={styles.vaultSlotExtra}
            onClick={() => setShowModal(true)}
            role="button"
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              style={styles.plusIcon}
              aria-hidden="true"
            >
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div style={styles.slotText}>Create more slots</div>
          </div>
        </div>

        {/* Register Vaults Button */}
        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <button
            onClick={handleRegisterVaults}
            disabled={vaults.filter((v) => v && !v.registered).length === 0}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              fontWeight: "600",
              background:
                vaults.filter((v) => v && !v.registered).length === 0
                  ? "#333"
                  : "#e50914",
              color: "white",
              cursor:
                vaults.filter((v) => v && !v.registered).length === 0
                  ? "not-allowed"
                  : "pointer",
              opacity:
                vaults.filter((v) => v && !v.registered).length === 0 ? 0.6 : 1,
            }}
          >
            Register Vaults
          </button>
        </div>
      </div>

      {/* Floating Dragged Vault */}
      {draggedVault && (
        <div
          style={{
            position: 'fixed',
            top: dragPosition.y - 20,
            left: dragPosition.x - 60,
            width: '120px',
            height: '50px',
            background: '#1a1a1a',
            border: '1px solid #e50914',
            borderRadius: '8px',
            boxShadow: '0 0 12px rgba(229,9,20,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '600',
            pointerEvents: 'none',
            zIndex: 9999,
            transform: hoveredSlot !== null ? 'scale(1.2)' : 'scale(1)',
            transition: 'transform 0.1s',
          }}
        >
          {draggedVault}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '16px' }}>Want to Create More Vaults ?</h3>
            <div style={styles.modalCards}>
              <div style={{ textAlign: 'center' }}>Paisa de pehle</div>
            </div>
            <button style={styles.closeBtn} onClick={() => setShowModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {modalMessage && (
        <div style={styles.modalOverlay} onClick={() => setModalMessage("")}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <p style={{ marginBottom: "20px" }}>{modalMessage}</p>
            <button style={styles.closeBtn} onClick={() => setModalMessage("")}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: 'black',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px',
    boxSizing: 'border-box',
  },
  topbar: {
    width: '100%',
    maxWidth: '1100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  userBox: {
    opacity: 0.9,
    fontSize: '14px',
    padding: '8px 12px',
    background: '#1a1a1a',
    borderRadius: '8px',
    boxShadow: '0 0 10px rgba(229,9,20,0.25)',
  },
  brand: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#e50914',
    letterSpacing: '0.5px',
  },
  profilePill: {
    width: '52px',
    height: '52px',
    background: '#1a1a1a',
    borderRadius: '999px',
    border: '1px solid rgba(229,9,20,0.45)',
    boxShadow: '0 0 10px rgba(229,9,20,0.25)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    padding: 0,
    overflow: 'hidden',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: '999px',
    border: 'none',
    objectFit: 'cover',
    background: '#0f0f0f',
  },
  horizontalSection: {
    width: '100%',
    maxWidth: '1100px',
    display: 'flex',
    justifyContent: 'space-between',
    background: '#141414',
    borderRadius: '10px',
    padding: '12px 20px',
    marginBottom: '32px',
    boxShadow: '0 0 12px rgba(229,9,20,0.25)',
  },
  hCard: {
    flex: 1,
    margin: '0 8px',
    padding: '12px',
    borderRadius: '8px',
    background: '#1a1a1a',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    border: '1px solid rgba(229,9,20,0.35)',
    boxShadow: '0 0 8px rgba(229,9,20,0.25)',
  },
  content: {
    width: '100%',
    maxWidth: '1100px',
  },
  vaultRow: {
    display: 'flex',
    gap: '20px',
    marginTop: '40px',
  },
  vaultSlot: {
    width: '220px',
    height: '320px',
    borderRadius: '12px',
    border: '1px dashed rgba(229,9,20,0.45)',
    background: '#1a1a1a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 14px rgba(229,9,20,0.25)',
  },
  vaultSlotExtra: {
    width: '220px',
    height: '320px',
    borderRadius: '12px',
    border: '1px solid rgba(229,9,20,0.75)',
    background: '#2a0a0a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 18px rgba(229,9,20,0.45)',
    cursor: 'pointer',
  },
  plusIcon: {
    color: '#e50914',
  },
  slotText: {
    marginTop: '8px',
    fontSize: '14px',
    opacity: 0.85,
  },
  deleteVaultBtn: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '28px',
    height: '28px',
    borderRadius: '999px',
    border: '1px solid rgba(229,9,20,0.55)',
    background: '#260708',
    color: '#ffd5d8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 0 8px rgba(229,9,20,0.35)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#1a1a1a',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 0 20px rgba(229,9,20,0.4)',
    width: '400px',
    textAlign: 'center',
  },
  modalCards: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '20px',
  },
  closeBtn: {
    padding: '8px 16px',
    background: '#e50914',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};
