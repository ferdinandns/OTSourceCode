const jwt = require("jsonwebtoken");

/* const veryfyToken = (req, res, next) => {
  let token = req.headers.authorization;

  if (!token) {
    return res.status(401).send("access dnied");
  }
  token = token.split(" ")[1];
  if (token == "null" || !token) {
    return res.status(401).send("access dnied");
  }

  //==============================================================
  try {
    // Verifikasi token
    const verifiedUser = jwt.verify(token, "khaerul");
    req.user = verifiedUser;
    // console.log(verifiedUser); // Log user yang diverifikasi
    next();
  } catch (err) {
    // Tangani error token, termasuk jika expired
    if (err.name === "TokenExpiredError") {
      return res.status(401).send("Token expired. Please login again.");
      next();
    }
    return res.status(401).send("Access denied. Invalid token.");
    next();
  }

  //==============================================================

  // let verifiedUser = jwt.verify(token, "khaerul");
  // console.log(verifiedUser);
  // if (!verifiedUser) {
  //   return res.status(401).send("access dnied");
  // }

  // req.user = verifiedUser;
  // console.log(verifiedUser);
  // next();
}; */

const veryfyToken = (req, res, next) => {
  try {
   // console.log('\n========== TOKEN VERIFICATION ==========');
    let token = req.headers.authorization;
    // console.log('📥 Authorization header present:', !!token);
    // console.log('📄 Full header:', token);

    if (!token) {
      console.log('❌ No authorization header');
      return res.status(401).send("access denied");
    }
    
    token = token.split(" ")[1];
    // console.log('🔑 Extracted token:', token ? token.substring(0, 50) + '...' : 'null');
    
    if (token == "null" || !token) {
      console.log('❌ Token is null or empty');
      return res.status(401).send("access denied");
    }

    //console.log('🔐 Verifying token with secret: "khaerul"');
    let verifiedUser = jwt.verify(token, "khaerul");
    //console.log('✅ Token verified successfully');
   // console.log('👤 User from token:', verifiedUser);
    
    if (!verifiedUser) {
      console.log('❌ Verified user is empty');
      return res.status(401).send("access dnied");
    }

    req.user = verifiedUser;
    console.log('========================================\n');
    next();
  } catch (error) {
    console.error('❌ TOKEN VERIFICATION ERROR:', error.message);
    console.error('Error type:', error.name);
    console.error('========================================\n');
    return res.status(401).send("access dnied");
  }
};

const checkRole = async (req, res, next) => {
  if (req.user.isAdmin) {
    return next();
  }
  return res.status(401).send("access dnied");
};

module.exports = { veryfyToken, checkRole };
