import { AuthPage } from '../components/auth/AuthPage';

interface SignUpPageProps {
   onSubmit: (payload: {
      fullName: string;
      email: string;
      password: string;
   }) => Promise<void> | void;
   onSwitchToSignIn: () => void;
}

export function SignUpPage({ onSubmit, onSwitchToSignIn }: SignUpPageProps) {
   const handleSignUpSubmit = async (payload: {
      fullName?: string;
      email: string;
      password: string;
   }) => {
      if (!payload.fullName) {
         throw new Error('Full name is required.');
      }

      await onSubmit({
         fullName: payload.fullName,
         email: payload.email,
         password: payload.password,
      });
   };

   return (
      <AuthPage
         mode="signup"
         onSubmit={handleSignUpSubmit}
         onSwitchMode={onSwitchToSignIn}
      />
   );
}
