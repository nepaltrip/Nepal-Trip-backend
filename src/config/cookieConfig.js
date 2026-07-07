const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
        httpOnly: true,
        secure: isProduction, // true on Render (HTTPS), false on Localhost (HTTP)
        sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-domain on Render, 'lax' for Localhost
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days match with refresh token expiry
    };
};

module.exports = getCookieOptions;