// src/app/utils/sendSms.js

export async function sendSMS(phone, message) {
  try {
    const res = await fetch("/api/sendSms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone, message }),
    });

    const data = await res.json();
    console.log("SMS sent:", data);
  } catch (err) {
    console.error("Failed to send SMS:", err);
  }
}
