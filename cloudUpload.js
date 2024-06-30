const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: "dcwrtjkux",
  api_key: "982372869888867",
  api_secret: "qEnYdH2ymremfHqatEXK6_o8HTM",
});

const cloudinaryUploadImage = (filePath, folder) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      filePath,
      { folder: folder },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
  });
};
module.exports = cloudinaryUploadImage;
