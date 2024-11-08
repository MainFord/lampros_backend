import { createOtpRequest, verifyOtpAndLogin, updateUserDetails } from '../functions/otp.js';
import { generateToken, verifyToken } from '../config/jwt.js';
import User from '../models/user.js';
import ProProject from '../models/pro-projects.js';
import Product from '../models/pro-products.js';
import Brand from '../models/brand.js';
import Category from '../models/catogory.js';
import { sendSmsvia2fact } from '../services/smsService.js';

export const requestOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const response = await createOtpRequest(phoneNumber);
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
      // Delete the user document
      await User.findByIdAndDelete(userId)

      // Delete all ProProjects created by the user
      await ProProject.deleteMany({ createdBy: userId })
  
      // Delete all Products created by the user
      await Product.deleteMany({ createdBy: userId })
  

    res.status(200).json({  message: 'Account and all associated data deleted successfully.' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Failed to delete account. Please try again later.' });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    const response = await verifyOtpAndLogin(phoneNumber, otp);
    
    // Generate JWT token
    const user = await User.findOne({ phoneNumber });
    const token = generateToken(user._id);

    res.status(200).json({ message: response.message, token });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const completeBasic = async (req, res) => {
  try {
    const { phoneNumber, f_name, l_name, profileImage, role } = req.body;

    // Update user details
    const response = await updateUserDetails(phoneNumber, { f_name, l_name, profileImage, role });

    // Fetch the updated user to generate the token
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = generateToken(user._id);

    res.status(200).json({ message: 'Registration complete', token });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const completeRegistration = async (req, res) => {
  try {
    const { phoneNumber, fname, lname, profileImage, role, type, email, companyDetails, address, couponCode } = req.body;

    const isNotEmpty = (value) => value !== undefined && value !== null && value !== '';

    // Array to track empty required fields
    const emptyFields = [];

    if (!isNotEmpty(fname)) emptyFields.push('fname');
    if (!isNotEmpty(lname)) emptyFields.push('lname');
    if (!isNotEmpty(role)) emptyFields.push('role');
    if (!isNotEmpty(email)) emptyFields.push('email');
    if (!isNotEmpty(address)) emptyFields.push('address');
    if (!isNotEmpty(couponCode) || couponCode !== 'OCT2024') return res.status(400).json({ message: 'Invalid Coupon Code' });  

    // If any required fields are empty, return an error response
    if (emptyFields.length > 0) {
      return res.status(400).json({
        message: 'The following required fields are empty:',
        emptyFields,
      });
    }

    // Proceed to build the updated fields object
    const updatedFields = {
      fname,
      lname,
      profileImage: isNotEmpty(profileImage)
        ? profileImage
        : 'https://static.vecteezy.com/system/resources/previews/009/734/564/non_2x/default-avatar-profile-icon-of-social-media-user-vector.jpg',
      role,
      type,
      email,
      ...(isNotEmpty(companyDetails) && { companyDetails }),
      ...(isNotEmpty(address) && { address }),
    };

    // Update user details
    const response = await updateUserDetails(phoneNumber, updatedFields);

    // Fetch the updated user to generate the token
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a token for the user
    const token = generateToken(user._id);

    await sendSmsvia2fact(phoneNumber,`*Welcome to Lampros!*

    Thank you for joining the Lampros family. You’re now one step closer to bringing your dream home to life! Explore a wide range of home designs, top-quality products, expert consultations, and connect with trusted professionals—all in one place.
    
    Feel free to start exploring the app, and if you have any questions or need assistance, we’re here to help.
    
    Welcome aboard, and happy homebuilding!
    
    *Team Lampros*
    India’s First Virtual Buildmart`)

    res.status(200).json({ message: 'Registration complete', token });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    // Get the user ID from the request (set by the protect middleware)
    const userId = req.user;

    // Fetch the user profile from the database
    const user = await User.findById(userId).select('-password -__v'); // Exclude password and other unnecessary fields

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const uploadImage = async (req, res) => {
  try {
    // Handle image upload
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log(req)

    res.status(200).json({
      message: 'File uploaded successfully',
      file: {
        url: req.file
      }
    });
  } catch (error) {
    console.log(error)
    res.status(400).json({ message: error.message });
  }
};


export const uploadImages = async (req, res) => {
  try {
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    // Log the entire request for debugging
    console.log(req);

    // Prepare an array of uploaded file URLs
    const uploadedFiles = req.files.map(file => ({
      url: file.path, // Cloudinary URL
      filename: file.filename // Cloudinary filename
    }));

    res.status(200).json({
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};



export const filterUsersWithProjectsOrProducts = async (req, res) => {
  try {
    // Extract query parameters and pagination settings
    const { role, type, page = 1, limit = 10 } = req.query;

    // Parse and validate pagination parameters
    const parsedPage = parseInt(page, 10) < 1 ? 1 : parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10) < 1 ? 10 : parseInt(limit, 10);
    const skip = (parsedPage - 1) * parsedLimit;

    // Build a filter object for MongoDB
    const filter = {};

    if (role) {
      const roleArray = role.split(','); // Split by comma for multiple roles
      filter.role = { $in: roleArray };
    }

    if (type) {
      const typeArray = type.split(','); // Split by comma for multiple types
      filter.type = { $in: typeArray };
    }

    // Fetch users based on the role and type with pagination
    const usersPromise = User.find(filter)
      .select('-password -__v') // Exclude password and other unnecessary fields
      .skip(skip)
      .limit(parsedLimit)
      .exec();

    const countPromise = User.countDocuments(filter).exec();

    const [users, total] = await Promise.all([usersPromise, countPromise]);

    // Prepare an array to store users with their projects/products
    const usersWithProjectsOrProducts = await Promise.all(
      users.map(async (user) => {
        let userWithDetails = user.toObject(); // Convert Mongoose doc to plain object

        // Depending on the role, fetch related projects or products
        if (user.role === 'Realtor' || user.role === 'Professionals') {
          // Fetch ProProjects where createdBy matches the user's _id
          const projects = await ProProject.find({ createdBy: user._id }).exec();
          userWithDetails.projects = projects; // Add projects to the user object
        } else if (user.role === 'Product Seller') {
          // Fetch Products where createdBy matches the user's _id
          const products = await Product.find({ createdBy: user._id }).exec();
          userWithDetails.products = products; // Add products to the user object
        }

        return userWithDetails;
      })
    );

    // Calculate total pages
    const totalPages = Math.ceil(total / parsedLimit);

    // Handle case where requested page exceeds total pages
    if (parsedPage > totalPages && totalPages !== 0) {
      return res.status(400).json({
        message: 'Page number exceeds total pages.',
        currentPage: parsedPage,
        totalPages,
        totalUsers: total,
        users: [],
      });
    }

    // Return the filtered users with their projects/products and pagination info
    res.status(200).json({
      currentPage: parsedPage,
      totalPages,
      totalUsers: total,
      users: usersWithProjectsOrProducts,
    });
  } catch (error) {
    console.error('Error retrieving users with projects/products:', error);
    res.status(500).json({ message: 'Failed to retrieve users with projects/products', error: error.message });
  }
};

const normalizeMobileNumber = (number) => {
  let normalized = number.replace(/\D/g, '');

  if (normalized.startsWith('91')) {
    normalized = normalized.slice(2);
  }

  if (normalized.startsWith('0')) {
    normalized = normalized.slice(1);
  }

  if (/^\d{10}$/.test(normalized)) {
    return normalized;
  }

  return null;
};




export const numCheck = async (req, res) => {
  

  try {
    const { number } = req.params;
    const normalizedNumber = normalizeMobileNumber(number);

    if (!normalizedNumber) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number format after normalization.',
      });
    }

    // Lookup user by normalized mobile number
    const user = await User.findOne({ mobileNumber: normalizedNumber });

    if (user) {
      const isRegistered = user.fname && user.email;

      if (isRegistered) {
        return res.status(200).json({
          success: true,
          message: 'Already registered user.',
        });
      } else {
        return res.status(200).json({
          success: true,
          message: 'User found. Please complete registration.',
        });
      }
    } else {
      return res.status(200).json({
        success: true,
        message: 'Number validated. No existing user found.',
      });
    }
  } catch (error) {
    logger.error('Error during number check:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};