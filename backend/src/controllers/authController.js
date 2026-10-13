const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  sendPasswordResetEmail,
} = require("../config/mailer");

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must contain at least 32 characters."
    );
  }

  return secret;
}

function createToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    getJwtSecret(),
    {
      expiresIn: "1d",
      issuer: "procureflow-api",
    }
  );
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId || null,
    status: user.status,
  };
}

function validEmail(email) {
  return (
    typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= PASSWORD_MIN &&
    password.length <= PASSWORD_MAX
  );
}

function passwordResetMessage() {
  return (
    "If an account exists for that email, password-reset " +
    "instructions will be provided."
  );
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 80
    ) {
      return res.status(400).json({
        success: false,
        message: "Name must contain 2–80 characters.",
      });
    }

    if (!validEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (!validPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain 8–72 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    }).select("_id");

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists. Please sign in.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "requester",
      status: "active",
    });

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    return next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (
      !validEmail(email) ||
      typeof password !== "string" ||
      !password.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email and password.",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message:
          "Your account is disabled. Contact your company administrator.",
      });
    }

    const token = createToken(user);

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  let user = null;

  try {
    const { email } = req.body || {};

    if (!validEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+resetPasswordTokenHash +resetPasswordExpires");

    const genericMessage = passwordResetMessage();

    // Do not reveal whether an email is registered.
    if (!user || user.status !== "active") {
      return res.json({
        success: true,
        message: genericMessage,
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpires = new Date(
      Date.now() + RESET_TOKEN_TTL_MS
    );

    await user.save();

    const frontendUrl = (
      process.env.FRONTEND_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    const resetUrl =
      `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (emailError) {
      // Invalidate the token if email delivery fails.
      user.resetPasswordTokenHash = undefined;
      user.resetPasswordExpires = undefined;

      try {
        await user.save();
      } catch (cleanupError) {
        console.error(
          "Could not clear unused password-reset token:",
          cleanupError.message
        );
      }

      return next(emailError);
    }

    return res.json({
      success: true,
      message: genericMessage,
    });
  } catch (error) {
    return next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body || {};

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token)
    ) {
      return res.status(400).json({
        success: false,
        message: "The reset link is invalid or has expired.",
      });
    }

    if (!validPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain 8–72 characters.",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
      status: "active",
    }).select(
      "+resetPasswordTokenHash +resetPasswordExpires +password"
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "The reset link is invalid or has expired.",
      });
    }

    user.password = await bcrypt.hash(password, 12);

    // Clear the token so it cannot be used again.
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.json({
      success: true,
      message: "Password reset successfully. You can now sign in.",
    });
  } catch (error) {
    return next(error);
  }
};
