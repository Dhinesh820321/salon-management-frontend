import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { Scissors, MapPin, AlertCircle, Smartphone, Key, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { loginWithPassword, requestOTP, verifyOTP } = useAuth();
  const { location, error: geoError } = useGeolocation();
  const [loginMethod, setLoginMethod] = useState('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoOTP, setDemoOTP] = useState(null);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await loginWithPassword(phone, password, location);
    
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await requestOTP(phone);
    
    if (result.success) {
      setOtpSent(true);
      setDemoOTP(result.data.demo_otp);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleOTPVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const deviceId = localStorage.getItem('deviceId') || 'device_' + Math.random().toString(36).substr(2, 9);
    
    const result = await verifyOTP(phone, otp, deviceId);
    
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Scissors className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">SalonPro</h1>
          <p className="text-gray-600 mt-2">Multi-Branch Salon Management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign In</h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {demoOTP && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700 font-medium">Demo OTP: {demoOTP}</p>
              <p className="text-xs text-green-600 mt-1">In production, this would be sent via SMS</p>
            </div>
          )}

          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => { setLoginMethod('password'); setOtpSent(false); setDemoOTP(null); }}
              className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 ${
                loginMethod === 'password' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Key className="w-4 h-4" />
              Password
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod('otp'); setOtpSent(false); setDemoOTP(null); }}
              className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 ${
                loginMethod === 'otp' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              OTP
            </button>
          </div>

          {loginMethod === 'password' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label htmlFor="phone" className="label">Phone Number</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="username"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  placeholder="Enter phone number"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-10"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4" />
                {geoError ? (
                  <span className="text-red-600">Location unavailable</span>
                ) : location ? (
                  <span className="text-green-600">Location captured</span>
                ) : (
                  <span className="text-yellow-600">Getting location...</span>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={otpSent ? handleOTPVerify : handleRequestOTP} className="space-y-4">
              <div>
                <label htmlFor="otpPhone" className="label">Phone Number</label>
                <input
                  id="otpPhone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  placeholder="Enter phone number"
                  disabled={otpSent}
                  required
                />
              </div>

              {otpSent && (
                <div>
                  <label htmlFor="otp" className="label">Enter OTP</label>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="input text-center text-2xl tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    OTP expires in 5 minutes
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 disabled:opacity-50"
              >
                {loading ? 'Processing...' : otpSent ? 'Verify OTP' : 'Send OTP'}
              </button>

              {otpSent && (
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(''); setDemoOTP(null); }}
                  className="btn-secondary w-full"
                >
                  Resend OTP
                </button>
              )}
            </form>
          )}

         
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Geo-fenced
          </div>
          <div className="flex items-center gap-1">
            <Smartphone className="w-3 h-3" />
            Device Bound
          </div>
        </div>
      </div>
    </div>
  );
}
