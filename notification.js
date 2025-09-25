// notification.js
// Sends SMS messages to a list of recipients using Twilio

const { sendEmailNotification } = require('./emailNotification');
const twilio = require('twilio');
const mysql = require('./mysql'); // Import MySQL functions
const { send } = require('vite');

let sms_enabled = false;

/**
 * Send an SMS message to a list of recipients using Twilio
 * @param settings
 * @param {string} message - The message to send
 * @returns {Promise<Array>} - Array of Twilio message responses
 */
async function sendSmsNotification(settings, message) {
    if (!sms_enabled) {
        console.log("Twilio settings are not properly configured.");
        return [];
    }
  let recipients = await mysql.getPhoneNumbers(settings);
  const client = twilio(settings.twilio_sid, settings.twilio_auth_token);
  const results = [];
  for (const to of recipients) {
    try {
      const msg = await client.messages.create({
        body: message,
        from: settings.twilio_number,
        to
      });
      results.push({ to, status: 'sent', sid: msg.sid });
    } catch (err) {
      results.push({ to, status: 'error', error: err.message });
    }
  }
  return results;
}

// Send a welcome message when a user signs up
async function sendWelcome (settings, to) {
  if (!sms_enabled) {
      console.log("Twilio settings are not properly configured.");
      return [];
  }
  const client = twilio(settings.twilio_sid, settings.twilio_auth_token);
  try {
      const msg = await client.messages.create({
          body: "Welcome to Tailwinds Flight Academy text messaging service! To stop receiving messages, reply STOP.",
          from: settings.twilio_number,
          to
      });
      console.log(`Sent welcome SMS to ${to}: ${msg.sid}`);
  } catch (err) {
      console.error(`Failed to send welcome SMS to ${to}: ${err.message}`);
  }
}

// Send response in appropriate format (JSON for web, TwiML for SMS)
function sendResponse(res, message, isSMS = false) {
  if (isSMS) {
    res.type('text/xml');
    res.send(`<Response><Message>${message}</Message></Response>`);
  } else {
    res.type('application/json');    
    res.send({ message });
  }
  
}

function handleSms(req, res, settings) {
  // Twilio will POST SMS data as x-www-form-urlencoded
  const { From, To, Body, MessageSid } = req.body;
  console.log(`Received SMS from ${From} to ${To}: ${Body} (MessageSid: ${MessageSid})`);
  if (!From || !Body) {
    res.status(400).send('Missing From or Body in SMS data');
    return;
  }
  const isSMS = MessageSid ? true : false;
  if (!sms_enabled) {
    sendResponse(res, "SMS handling is not enabled. Contact Greg for assistance.", isSMS);
    return;
  }
  if (!isValidUSPhoneNumber(From)) {
    sendResponse(res, "Invalid phone number format. Please use a valid US phone number.", isSMS);
    return;
  }
  const command = Body.trim().toLowerCase();
  if (command === 'add') {
    // Add the phone number to the squawk list
    mysql.addPhoneNumber(settings, From).then((added) => {  
      if (added) {
        console.log(`Added phone number ${From} to squawk list.  Reply with 'STOP' to remove.`);
        sendResponse(res, "Phone number added to squawk list.", isSMS);
        if (!isSMS) {
          sendWelcome(settings, From);
        }
      } else {
        console.log(`Phone number ${From} is already in squawk list`);
        sendResponse(res, "Phone number is already in squawk list.", isSMS);
      }
    });
    return;
  } else if (command === 'remove' || command === 'stop') {
    // Remove the phone number from the squawk list
    mysql.removePhoneNumber(settings, From).then((removed) => {
      if (removed) {
        console.log(`Removed phone number ${From} from squawk list`);
        sendResponse(res, "Phone number removed from squawk list.", isSMS);
      } else {
        console.log(`Phone number ${From} was not found in squawk list`);
        sendResponse(res, "Phone number was not found in squawk list.", isSMS);
      }
    });
    return;
  } else {
  // Respond with TwiML (empty response is OK for most cases)
    sendResponse(res, "Unknown code. Response handling in development.  Contact Greg for assistance.", isSMS);
  }
};

async function sendNotification(settings, message) {
  try {
    if (settings.email) {
      // Send email notification
      const emailResults = await sendEmailNotification(settings, "greg@docgreg.com", "Test Subject", message, false);
      console.log("Email notification results:", emailResults);
    } else {
      // Send SMS notification
      const smsResults = await sendSmsNotification(settings, message);
      console.log("SMS notification results:", smsResults);
    }
  } catch (err) {
    console.error("Error sending notification:", err);
  }
}

async function checkSmsEnabled(settings) {
  try {
    if (!settings.twilio_sid || !settings.twilio_auth_token || !settings.twilio_number) {
        console.log("Twilio settings are not properly configured.");
        return false;
    }
    const numbers = await mysql.getPhoneNumbers(settings);  
    sms_enabled = true;
    console.log("SMS is enabled. Current squawk list phone numbers:", numbers);
    return true;
  } catch (err) {
    console.error("SMS will be disabled. Error fetching phone numbers from database:", err);
    return false;
  }
}

/**
 * Check if a phone number is a valid US phone number (E.164 or 10-digit)
 * @param {string} phone
 * @returns {boolean}
 */
function isValidUSPhoneNumber(phone) {
  // Accepts +1XXXXXXXXXX or 1XXXXXXXXXX or XXXXXXXXXX
  return /^\+1\d{10}$/.test(phone);
}

module.exports = { sendSmsNotification, sendNotification, handleSms, checkSmsEnabled };
