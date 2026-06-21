-- Extend update_community_settings so the admin settings screen can actually
-- persist every field it edits.
--
-- Before this migration the RPC only accepted name/about/icon/tint/join_policy/
-- default_category/guidelines/members_only/discoverable/allow_links/post_approval,
-- and `p_guidelines` was typed `text` even though the column is `text[]`. The
-- client never sent guidelines, default_category, enabled_topics,
-- require_photo_lost_found or show_location, so those toggles silently reverted
-- on reload.
--
-- We must DROP first because the signature changes (p_guidelines text -> text[]
-- plus three new parameters); CREATE OR REPLACE cannot alter existing param types.

DROP FUNCTION IF EXISTS public.update_community_settings(
  uuid, text, text, text, text, join_policy_enum,
  community_category_enum, text, boolean, boolean, boolean, boolean
);

CREATE OR REPLACE FUNCTION public.update_community_settings(
  p_community uuid,
  p_name text DEFAULT NULL,
  p_about text DEFAULT NULL,
  p_icon text DEFAULT NULL,
  p_tint text DEFAULT NULL,
  p_join_policy join_policy_enum DEFAULT NULL,
  p_default_category community_category_enum DEFAULT NULL,
  p_guidelines text[] DEFAULT NULL,
  p_members_only boolean DEFAULT NULL,
  p_discoverable boolean DEFAULT NULL,
  p_allow_links boolean DEFAULT NULL,
  p_post_approval boolean DEFAULT NULL,
  p_enabled_topics community_category_enum[] DEFAULT NULL,
  p_require_photo_lost_found boolean DEFAULT NULL,
  p_show_location boolean DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_community_admin(p_community) THEN RAISE EXCEPTION 'not_admin'; END IF;

  UPDATE communities SET
    name                     = COALESCE(p_name, name),
    about                    = COALESCE(p_about, about),
    icon                     = COALESCE(p_icon, icon),
    tint                     = COALESCE(p_tint, tint),
    join_policy              = COALESCE(p_join_policy, join_policy),
    default_category         = COALESCE(p_default_category, default_category),
    guidelines               = COALESCE(p_guidelines, guidelines),
    members_only             = COALESCE(p_members_only, members_only),
    discoverable             = COALESCE(p_discoverable, discoverable),
    allow_links              = COALESCE(p_allow_links, allow_links),
    post_approval            = COALESCE(p_post_approval, post_approval),
    enabled_topics           = COALESCE(p_enabled_topics, enabled_topics),
    require_photo_lost_found = COALESCE(p_require_photo_lost_found, require_photo_lost_found),
    show_location            = COALESCE(p_show_location, show_location),
    updated_at               = now()
  WHERE id = p_community;
END;
$$;
