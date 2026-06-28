import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

const client = twilio(accountSid, authToken);

const sendSms = async (to: string, body: string) => {
  try {
    const message = await client.messages.create({
      body,
      from: fromNumber,
      to,
    });
    return message.sid;
  } catch (error) {
    console.error("Error sending SMS:", error);
    throw error;
  }
};

export default sendSms;
