// Central configuration for Jain Vivah.
// Every page loads this file before app.js.

const SUPABASE_URL = "https://wrzpgultvahxbrgooibn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyenBndWx0dmFoeGJyZ29vaWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Mzc2MTcsImV4cCI6MjA5MzExMzYxN30.sZM4GQiwom34d7TjeK_Jc_n8KYoC8VhI48jfq71dwb8";

const APP_NAME = "Jain Vivah";
const SUPPORT_EMAIL = "vkvcoder.support@gmail.com";

// This Supabase project is shared with other apps, so its dashboard Site URL
// points elsewhere. Every auth call that sends an email must pass its own
// redirect explicitly, built from this.
const APP_URL = "https://jainvivah.anyapps.in";

// WhatsApp number members message to verify their mobile (manual process).
// Replace with the real number, in international format with no + or spaces
// (e.g. "919812345678").
const WHATSAPP_VERIFY_NUMBER = "919XXXXXXXXX";
