import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect, useRef } from "react";
import { ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppLogo from "../../src/components/common/AppLogo";
import { APP_NAME, APP_VERSION } from "../../src/constants/app";
import { useTheme } from "../../src/context/ThemeContext";
import { passwordResetService as service, PasswordResetError } from "../../src/services/password-reset.service";
const { height } = Dimensions.get("window");
type Step = 'email' | 'code' | 'password' | 'done';

export default function ForgotPasswordScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const [step, setStep] = useState<Step>('email'), [email, setEmail] = useState(''), [otp, setOtp] = useState('');
  const [challenge, setChallenge] = useState(''), [grant, setGrant] = useState('');
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [retryAt, setRetryAt] = useState(0), [expiresAt, setExpiresAt] = useState(0), [now, setNow] = useState(Date.now());
  const mounted = useRef(true), pending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (step === 'done') return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [step]);
  const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const expired = !!expiresAt && now >= expiresAt;
  const backToLogin = () => router.replace('/(auth)/login');
  const failed = (e: unknown) => {
    setError(e instanceof Error ? e.message : 'Unable to complete this request. Please retry.');
    if (e instanceof PasswordResetError && e.retryAfter) { setRetryAt(Date.now() + e.retryAfter * 1000); setNow(Date.now()); }
  };
  const send = async () => {
    if (pending.current || Date.now() < retryAt) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 255) { setError('Enter the email address registered with AIMS.'); return; }
    pending.current = true; setLoading(true); setError(''); setNotice('');
    try {
      const data = await service.request(email);
      if (!mounted.current) return;
      setEmail(email.trim()); setChallenge(data.challenge_id); setGrant(''); setOtp(''); setPassword(''); setConfirmation('');
      setRetryAt(Date.now() + data.resend_after * 1000); setExpiresAt(Date.now() + data.expires_in * 1000); setNow(Date.now());
      setNotice(data.message); setStep('code');
    } catch (e) { if (mounted.current) failed(e); }
    finally { pending.current = false; if (mounted.current) setLoading(false); }
  };
  const verify = async () => {
    if (pending.current) return;
    if (!/^[0-9]{6}$/.test(otp)) { setError('Enter the six-digit code from your email.'); return; }
    if (Date.now() >= expiresAt) { setError('This code has expired. Request a new code.'); return; }
    pending.current = true; setLoading(true); setError('');
    try {
      const data = await service.verify(challenge, otp);
      if (!mounted.current) return;
      setGrant(data.reset_token); setOtp(''); setNotice('Email verified. Choose your new password.');
      setExpiresAt(Date.now() + data.expires_in * 1000); setNow(Date.now()); setStep('password');
    } catch (e) { if (mounted.current) failed(e); }
    finally { pending.current = false; if (mounted.current) setLoading(false); }
  };
  const reset = async () => {
    if (pending.current) return;
    if (password.length < 8 || password.length > 128) { setError('Use a password between 8 and 128 characters.'); return; }
    if (!password.trim()) { setError('Your password cannot contain only spaces.'); return; }
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    if (Date.now() >= expiresAt) { setError('Your reset session expired. Request a new code.'); return; }
    pending.current = true; setLoading(true); setError('');
    try {
      const data = await service.complete(challenge, grant, password);
      if (!mounted.current) return;
      setGrant(''); setChallenge(''); setPassword(''); setConfirmation(''); setNotice(data.message); setStep('done');
    } catch (e) { if (mounted.current) failed(e); }
    finally { pending.current = false; if (mounted.current) setLoading(false); }
  };
  const startAgain = () => { if (loading) return; setStep('email'); setGrant(''); setChallenge(''); setOtp(''); setPassword(''); setConfirmation(''); setError(''); setNotice(''); setExpiresAt(0); };
  const title = { email: 'Reset your password', code: 'Check your email', password: 'Choose a new password', done: 'Password updated' }[step];
  const subtitle = { email: 'Enter your registered email to receive a six-digit reset code.', code: `Enter the code sent to your registered email. Codes expire after 10 minutes.`, password: 'Use 8–128 characters and a password different from your current one.', done: 'You can now sign in with your new password.' }[step];
  const field = (label: string, value: string, change: (v: string) => void, kind: 'email' | 'code' | 'password', onSubmit: () => void) => <View style={styles.fieldWrapper}>
    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{label}</Text>
    <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
      <Ionicons name={kind === 'email' ? 'mail-outline' : kind === 'code' ? 'keypad-outline' : 'lock-closed-outline'} size={20} color={colors.textSecondary} style={styles.inputIcon} />
      <TextInput accessibilityLabel={label} style={[styles.input, {color: colors.textPrimary}]} placeholder={kind === 'email' ? 'you@example.com' : kind === 'code' ? '000000' : label} placeholderTextColor={colors.textTertiary} value={value} onChangeText={change} editable={!loading} autoCapitalize="none" autoCorrect={false} keyboardType={kind === 'email' ? 'email-address' : kind === 'code' ? 'number-pad' : 'default'} secureTextEntry={kind === 'password' && !visible} maxLength={kind === 'email' ? 255 : kind === 'code' ? 6 : 128} textContentType={kind === 'code' ? 'oneTimeCode' : kind === 'email' ? 'emailAddress' : 'newPassword'} autoComplete={kind === 'email' ? 'email' : kind === 'code' ? 'one-time-code' : 'new-password'} onSubmitEditing={onSubmit} returnKeyType="done" />
      {kind === 'password' && <TouchableOpacity accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={() => setVisible(v => !v)} style={{padding: 10}}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} /></TouchableOpacity>}
    </View>
  </View>;
  return <View style={[styles.container, {backgroundColor: colors.background}]}>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <View style={[styles.navySection, {backgroundColor: '#0b0b2f'}]}><View style={styles.circleTopLeft} /><View style={styles.circleBottomRight} /></View>
    <TouchableOpacity accessibilityLabel="Toggle theme" style={[styles.themeToggle, {backgroundColor:'rgba(255,255,255,0.12)'}]} onPress={toggleTheme}><Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={24} color="#fff" /></TouchableOpacity>
    <SafeAreaView style={[styles.safeArea, {backgroundColor:'transparent'}]}><KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.headerContent}><View style={styles.logoWrapper}><AppLogo size={100} decorative variant="login" /></View><Text style={[styles.brandTitle, {color:'#fff'}]}>A<Text style={{color:'#ffc629'}}>I</Text>MS</Text><Text style={[styles.systemTitle, {color:'#fff'}]}>Academic Internship Management System</Text></View>
      <View style={styles.cardWrapper}><View style={[styles.card, {backgroundColor: colors.card}]}>
        <View style={styles.cardHeader}><Text style={[styles.welcomeText, {color: colors.textPrimary}]}>{title}</Text><Text style={[styles.subtitleText, {color: colors.textSecondary}]}>{subtitle}</Text></View>
        <View style={styles.formContainer}>
          <View style={{flexDirection:'row', gap:8, marginBottom:20}}>{['Email', 'Verify', 'Password'].map((label,index) => { const current = {email:0, code:1, password:2, done:3}[step]; return <View key={label} style={{flex:1, gap:6}}><View style={{height:4, borderRadius:4, backgroundColor:index <= current ? colors.accent : colors.border}} /><Text style={{fontSize:11, color:index <= current ? colors.textPrimary : colors.textTertiary}}>{index+1}. {label}</Text></View>; })}</View>
          {!!notice && <View style={[styles.successContainer, {backgroundColor: colors.surfaceSecondary, borderColor: colors.border}]}><Text accessibilityRole="text" style={[styles.successText, {color:colors.textSecondary}]}>{notice}</Text></View>}
          {step === 'email' && field('Registered email', email, v => {setEmail(v); setError('');}, 'email', () => void send())}
          {step === 'code' && <><Text style={{color:colors.textSecondary, marginBottom:14}}>{email}</Text>{field('Verification code', otp, v => {setOtp(v.replace(/\D/g,'')); setError('');}, 'code', () => void verify())}{expired && <Text style={{color:colors.error, marginBottom:12}}>Code expired. Request a new one below.</Text>}</>}
          {step === 'password' && <>{field('New password',password,v => {setPassword(v);setError('');},'password',() => void reset())}{field('Confirm password',confirmation,v => {setConfirmation(v);setError('');},'password',() => void reset())}{expired && <Text style={{color:colors.error, marginBottom:12}}>Your reset session expired. Start again below.</Text>}</>}
          {!!error && <Text accessibilityRole="alert" style={[styles.errorText,{color:colors.error, marginBottom:14}]}>{error}</Text>}
          <TouchableOpacity accessibilityRole="button" disabled={loading || (step === 'email' && seconds > 0) || ((step === 'code' || step === 'password') && expired)} accessibilityState={{disabled:loading,busy:loading}} onPress={() => {if(step==='email')void send();else if(step==='code')void verify();else if(step==='password')void reset();else backToLogin();}} style={[styles.resetButton,{backgroundColor:colors.accent,opacity:loading || ((step==='code'||step==='password')&&expired) ? .5 : 1}]}>{loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={[styles.resetButtonText,{color:colors.onAccent}]}>{step==='email' ? seconds > 0 ? `Try again in ${seconds}s` : 'Send reset code' : step==='code' ? 'Verify code' : step==='password' ? 'Save new password' : 'Sign in'}</Text>}</TouchableOpacity>
          {step === 'code' && <TouchableOpacity disabled={loading || seconds > 0} onPress={() => void send()} style={{padding:16,alignItems:'center'}}><Text style={{color:seconds > 0 ? colors.textTertiary : colors.accent}}>{seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'}</Text></TouchableOpacity>}
          {(step==='code'||step==='password') && <TouchableOpacity disabled={loading} onPress={startAgain} style={{padding:12,alignItems:'center'}}><Text style={{color:colors.accent}}>{step==='code' ? 'Use a different email' : 'Start again'}</Text></TouchableOpacity>}
          {step !== 'done' && <TouchableOpacity disabled={loading} style={styles.backContainer} onPress={backToLogin}><Ionicons name="arrow-back-outline" size={18} color={colors.accent} style={styles.backIcon} /><Text style={[styles.backText,{color:colors.accent}]}>Back to login</Text></TouchableOpacity>}
        </View>
      </View></View>
      <View style={[styles.footer,{backgroundColor:colors.background}]}><Text style={[styles.footerText,{color:colors.textSecondary}]}>© {new Date().getFullYear()} {APP_NAME}</Text><Text style={[styles.versionText,{color:colors.textTertiary}]}>{APP_VERSION}</Text></View>
    </ScrollView></KeyboardAvoidingView></SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  navySection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.40,
    overflow: 'hidden',
  },

  themeToggle: {
    position: "absolute",
    top: 55,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    zIndex: 999,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  circleTopLeft: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },

  circleBottomRight: {
    position: 'absolute',
    bottom: -80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },

  dotGridTopRight: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 64,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  dotGridBottomLeft: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    width: 52,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    margin: 4,
  },

  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },

  headerContent: {
    paddingTop: 20,
    paddingBottom: 10,
    paddingHorizontal: 30,
    alignItems: "center",
    minHeight: height * 0.28,
  },

  logoWrapper: {
    marginBottom: 2,
  },

  brandTitle: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 2,
  },

  brandTitleAccent: {
    color: "#F5A623",
  },

  systemTitle: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  cardWrapper: {
    paddingHorizontal: 24,
    marginTop: -30,
  },

  card: {
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 30,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 12,
  },

  cardHeader: {
    marginBottom: 24,
  },

  welcomeText: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 4,
  },

  subtitleText: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
  },

  formContainer: {
    width: "100%",
  },

  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },

  successIcon: {
    marginRight: 12,
  },

  successText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },

  fieldWrapper: {
    marginBottom: 18,
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },

  inputWrapperFocused: {
    borderWidth: 1.5,
  },

  inputWrapperError: {
    borderColor: '#EF4444',
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    fontSize: 15,
  },

  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },

  resetButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 6,
    marginBottom: 16,
  },

  resetButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },

  resetButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  resetButtonIcon: {
    marginRight: 8,
  },

  resetButtonText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  backContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
  },

  backIcon: {
    marginRight: 6,
  },

  backText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 16,
    alignItems: "center",
    gap: 3,
  },

  footerText: {
    fontSize: 11,
    fontWeight: "400",
    letterSpacing: 0.2,
    textAlign: "center",
    opacity: 0.8,
  },

  versionText: {
    fontSize: 10,
    letterSpacing: 0.2,
    opacity: 0.7,
  },
});