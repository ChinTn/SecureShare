import { Resend } from 'resend';

// The Resend SDK automatically uses the RESEND_API_KEY from your .env file
const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationEmail = async (toEmail, verificationToken) => {
    try {
        const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

        // Send the email via HTTP POST request (Bypasses Render's SMTP blocks)
        const data = await resend.emails.send({
            from: 'SecureShare <onboarding@resend.dev>', // Resend gives you a test domain by default
            to: toEmail,
            subject: 'Verify Your SecureShare Account',
            html: `
                <h2>Welcome to SecureShare!</h2>
                <p>Please verify your email address by clicking the link below:</p>
                <a href="${verifyUrl}" target="_blank">Verify Email</a>
                <br />
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p>${verifyUrl}</p>
            `,
        });

        console.log("Email sent successfully via Resend:", data);
        return true;
    } catch (error) {
        console.error("Error sending email with Resend: ", error);
        return false;
    }
};
