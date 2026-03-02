import Twilio from "twilio";

export async function POST(req) {
  try {
    const { phone, message } = await req.json();

    const client = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const sms = await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,       // e.g., "+919876543210"
      body: message,
    });

    return new Response(JSON.stringify({ success: true, sid: sms.sid }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Twilio SMS error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
