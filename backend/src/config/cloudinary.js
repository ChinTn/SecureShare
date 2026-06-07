import { v2 as cloudinary } from 'cloudinary';

// Cloudinary will automatically look for the CLOUDINARY_URL in  .env, 
// but we can be explicit here to match variable names:

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});
export default cloudinary;