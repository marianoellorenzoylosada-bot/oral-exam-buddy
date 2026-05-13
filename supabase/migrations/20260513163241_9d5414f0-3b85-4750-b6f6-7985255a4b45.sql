CREATE OR REPLACE FUNCTION public.prevent_self_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow rows inserted by SECURITY DEFINER bootstrap (auth.uid() is null then)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'admin'::public.app_role AND NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Self-escalation to admin is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_no_self_admin ON public.user_roles;
CREATE TRIGGER user_roles_no_self_admin
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_admin_escalation();