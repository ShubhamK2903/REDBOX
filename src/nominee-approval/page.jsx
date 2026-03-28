"use client";

import { useSearchParams } from "next/navigation";
import PocketBase from "pocketbase";

const pb = new PocketBase("http://127.0.0.1:8090");

export default function NomineeApprovalPage() {
  const params = useSearchParams();

  const vaultId = params.get("vaultId");
  const owner = params.get("owner");
  const name = params.get("nominee");
  const handleAccept = async () => {
    try {
        await pb.collection("vault_approvals").create({
            vault_id: vaultId,
            nominee_name: name,
            status: "approved",
        });

        alert(`✅ ${name}, you accepted the request for vault ${vaultId}`);
    } catch (err) {
            console.error(err);
            alert("❌ Failed to save approval");
    }
  };

  const handleReject = async () => {
    try {
        await pb.collection("vault_approvals").create({
            vault_id: vaultId,
            nominee_name: name,
            status: "rejected",
        });

        alert(`❌ ${name}, you rejected the request for vault ${vaultId}`);
    } catch (err) {
        console.error(err);
        alert("❌ Failed to save rejection");
    }
 };

  return (
    <div style={styles.page}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Vault Access Request</h2>

        <p style={styles.text}>
          <strong>{owner}</strong> has requested you to be a nominee for vault:
        </p>

        <div style={styles.vaultBox}>{vaultId}</div>

        <p style={styles.subText}>
          Please choose whether you want to participate in this secure vault system.
        </p>

        <div style={styles.btnRow}>
          <button style={styles.acceptBtn} onClick={handleAccept}>
            Accept Approval
          </button>

          <button style={styles.rejectBtn} onClick={handleReject}>
            Reject Approval
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "black",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "'Orbitron', sans-serif",
    color: "white",
  },

  modal: {
    background: "#1a1a1a",
    padding: "32px",
    borderRadius: "16px",
    textAlign: "center",
    boxShadow: "0 0 25px rgba(229, 9, 20, 0.5)",
    maxWidth: "420px",
    width: "90%",
    border: "1px solid rgba(229,9,20,0.3)",
  },

  title: {
    color: "#e50914",
    marginBottom: "16px",
    fontSize: "22px",
    letterSpacing: "0.5px",
  },

  text: {
    color: "#ccc",
    fontSize: "14px",
    marginBottom: "10px",
  },

  vaultBox: {
    background: "#0f0f0f",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid rgba(229,9,20,0.4)",
    marginBottom: "16px",
    fontWeight: "bold",
    color: "#e50914",
  },

  subText: {
    fontSize: "12px",
    color: "#888",
    marginBottom: "20px",
  },

  btnRow: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
  },

  acceptBtn: {
    padding: "10px 16px",
    background: "#e50914",
    border: "none",
    borderRadius: "999px",
    color: "white",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 0 10px rgba(229,9,20,0.4)",
  },

  rejectBtn: {
    padding: "10px 16px",
    background: "#333",
    border: "none",
    borderRadius: "999px",
    color: "white",
    fontWeight: "600",
    cursor: "pointer",
  },
};