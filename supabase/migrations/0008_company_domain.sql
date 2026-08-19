-- ---------------------------------------------------------------------------
-- 0008 — Correct the seeded company email to the real domain
--
-- Migration 0003 seeded site_settings with a placeholder on the wrong domain
-- (`hello@edrifttrikes.com`). That value renders in the site footer, so any
-- store that ran 0003 and never edited its settings is publishing a contact
-- address on a domain the company doesn't own.
--
-- The company domain is edrifttrikes.shop.
--
-- CONDITIONAL ON PURPOSE: only rows still holding the old placeholder are
-- touched. An admin who has already set a real address in /admin/settings
-- keeps it.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

update public.site_settings
   set company_email = 'hello@edrifttrikes.shop'
 where company_email = 'hello@edrifttrikes.com';
