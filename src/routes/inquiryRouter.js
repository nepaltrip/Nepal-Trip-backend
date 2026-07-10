const express = require('express');
const inquiryRouter = express.Router();
const Inquiry = require('../models/Inquiry');

inquiryRouter.post('/', async (req, res) => {
    try {
        const { formData, packageId } = req.body;

        if (!formData) {
            return res.status(400).json({ message: "Form data is required." });
        }

        const newInquiry = new Inquiry({
            formData,
            packageId: packageId || null,
            userId: req.user ? req.user.id : null // Link to logged-in user if token exists
        });

        await newInquiry.save();
        res.status(201).json({ message: "Inquiry submitted successfully!" });
    } catch (error) {
        console.error("Inquiry Submission Error:", error);
        res.status(500).json({ message: "Failed to submit inquiry." });
    }
});

module.exports = inquiryRouter;