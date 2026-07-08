// index.js (Firebase Cloud Functions)
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();
const db = admin.firestore();

// Apna secret verify token set karein
const VERIFY_TOKEN = 'TRUEINVEST_CRM_SECRET_2026'; 
// Meta Graph API Token (Facebook Developer dashboard se milega)
const PAGE_ACCESS_TOKEN = 'YOUR_META_GRAPH_API_ACCESS_TOKEN'; 

exports.metaLeadWebhook = functions.https.onRequest(async (req, res) => {
    
    // 1. Meta Webhook Verification (Ek baar hota hai setup ke time)
    if (req.method === 'GET') {
        let mode = req.query['hub.mode'];
        let token = req.query['hub.verify_token'];
        let challenge = req.query['hub.challenge'];

        if (mode && token) {
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('WEBHOOK_VERIFIED');
                return res.status(200).send(challenge);
            } else {
                return res.sendStatus(403);
            }
        }
    }

    // 2. Receiving Lead Data when user submits Facebook form
    if (req.method === 'POST') {
        let body = req.body;

        if (body.object === 'page') {
            for (let entry of body.entry) {
                let webhookEvent = entry.changes[0];

                if (webhookEvent.field === 'leadgen') {
                    const leadId = webhookEvent.value.leadgen_id;
                    const formId = webhookEvent.value.form_id;

                    try {
                        // Meta Graph API call karke lead id se actual Name, Phone nikalna
                        const response = await axios.get(`https://graph.facebook.com/v19.0/${leadId}?access_token=${PAGE_ACCESS_TOKEN}`);
                        const leadData = response.data.field_data;

                        let fullName = '';
                        let phoneNum = '';

                        leadData.forEach(field => {
                            if (field.name === 'full_name') fullName = field.values[0];
                            if (field.name === 'phone_number') phoneNum = field.values[0];
                        });

                        // Firestore Database mein Save Karna (Ye aapke HTML CRM mein auto-reflect hoga)
                        await db.collection('leads').add({
                            name: fullName,
                            phone: phoneNum,
                            leadSource: 'Facebook Ads', // Auto assign source
                            status: 'New',              // New Kanban category
                            leadTemperature: 'Warm',
                            leadDate: new Date().toISOString().split('T')[0], // Aaj ki date
                            visitDone: false,
                            budget: "",
                            projectCategory: "",
                            specificUnit: "",
                            ownerId: "YOUR_ADMIN_UID_HERE", // CRM Owner ID (Optional ya Hardcoded)
                            remark: 'Lead generated automatically via Meta Ads Webhook.',
                            history: [{
                                date: new Date().toISOString().split('T')[0],
                                time: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true }),
                                note: 'Lead generated automatically via Meta Ads Webhook.'
                            }]
                        });
                        
                        console.log('Success! Lead saved to TrueInvest CRM.');
                    } catch (error) {
                        console.error('Error fetching or saving lead from Meta API:', error);
                    }
                }
            }
            return res.status(200).send('EVENT_RECEIVED');
        } else {
            return res.sendStatus(404);
        }
    }
});