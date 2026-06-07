import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  useEffect(() => {
    const initAuth = () => {
      try {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        const firstLogin = localStorage.getItem('isFirstLogin');
        
        if (storedUser && token && storedUser !== 'undefined') {
          setUser(JSON.parse(storedUser));
          setIsFirstLogin(firstLogin === 'true');
        }
      } catch (error) {
        console.warn('Failed to parse stored user:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('isFirstLogin');
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const loginWithPassword = async (phone, password, location = null) => {
    try {
      const data = {
        phone,
        password,
        device_id: localStorage.getItem('deviceId') || generateDeviceId(),
        ...(location && {
          latitude: location.latitude,
          longitude: location.longitude
        })
      };
      
      const response = await authAPI.login(data);
      const { token, user: userData, is_first_login } = response.data.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('isFirstLogin', is_first_login ? 'true' : 'false');
      
      if (userData.device_id) {
        localStorage.setItem('deviceId', userData.device_id);
      }
      
      setUser(userData);
      setIsFirstLogin(is_first_login);
      
      return { success: true, data: response.data.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Login failed' };
    }
  };

  const requestOTP = async (phone) => {
    try {
      const response = await authAPI.requestOTP({ phone });
      return { success: true, data: response.data.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to send OTP' };
    }
  };

  const verifyOTP = async (phone, otp, deviceId) => {
    try {
      const response = await authAPI.verifyOTP({ 
        phone, 
        otp,
        device_id: deviceId
      });
      
      const { token, user: userData } = response.data.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('isFirstLogin', 'false');
      localStorage.setItem('deviceId', deviceId);
      
      setUser(userData);
      setIsFirstLogin(false);
      
      return { success: true, data: response.data.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'OTP verification failed' };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await authAPI.changePassword({ currentPassword, newPassword });
      
      if (response.data.success) {
        localStorage.setItem('isFirstLogin', 'false');
        setIsFirstLogin(false);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to change password' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isFirstLogin');
    setUser(null);
    setIsFirstLogin(false);
  };

  const updateUser = (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const generateDeviceId = () => {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isFirstLogin,
      loginWithPassword, 
      requestOTP,
      verifyOTP,
      changePassword,
      logout, 
      updateUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
