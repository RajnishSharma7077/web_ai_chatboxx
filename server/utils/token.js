import jwt from 'jsonwebtoken';

export const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || 'fallback-secret-key';

  return jwt.sign(
    {
      id: user.id || user._id,
      email: user.email,
      name: user.name
    },
    secret,
    { expiresIn: '7d' }
  );
};
