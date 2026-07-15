const express = require('express');
const Package = require('../models/Package');

const SitemapRouter = express.Router();

SitemapRouter.get('/sitemap.xml', async (req, res) => {
    try {
        // 1. Fetch only the slugs and updatedAt timestamps to keep the query blazing fast
        const packages = await Package.find({}, 'slug updatedAt').lean();

        const baseUrl = 'https://nepaltrip.in';

        // 2. Define your core static pages
        const staticPages = [
            { path: '/', priority: '1.00' },
            { path: '/packages', priority: '0.90' },
            { path: '/discover', priority: '0.85' },
            { path: '/services', priority: '0.80' },
            { path: '/about', priority: '0.70' },
            { path: '/contact', priority: '0.70' },
            { path: '/gallery', priority: '0.60' },
            { path: '/testimonials', priority: '0.60' }
        ];

        // 3. Start compiling the raw XML string
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        // Append static core routes
        staticPages.forEach(page => {
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}${page.path}</loc>\n`;
            xml += `    <priority>${page.priority}</priority>\n`;
            xml += `  </url>\n`;
        });

        // Append dynamic database packages safely
        packages.forEach(pkg => {
            if (pkg.slug) {
                // Ensure the date is cleanly formatted for Googlebot (YYYY-MM-DD)
                const lastMod = pkg.updatedAt ? new Date(pkg.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

                xml += `  <url>\n`;
                xml += `    <loc>${baseUrl}/packages/${pkg.slug}</loc>\n`;
                xml += `    <lastmod>${lastMod}</lastmod>\n`;
                xml += `    <priority>0.80</priority>\n`;
                xml += `  </url>\n`;
            }
        });

        xml += `</urlset>`;

        // 4. CRITICAL: Set content-type header to XML so search crawlers don't reject it as text/html
        res.header('Content-Type', 'text/xml');
        res.status(200).send(xml);

    } catch (error) {
        console.error("Sitemap generation layout dropped:", error);
        res.status(500).end();
    }
});

module.exports = SitemapRouter;