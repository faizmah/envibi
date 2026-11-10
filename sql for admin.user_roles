UPDATE public.user_roles
SET role = 'ADMIN'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'email_anda@gmail.com'
);