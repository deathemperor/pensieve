-- Portraits Phase 1 placeholder data.
-- 12 contacts with is_placeholder=1. Guests see exactly these; admin filters them out by default.

INSERT OR REPLACE INTO contacts
  (id, full_name, display_name, title, company, company_domain, prestige_tier, tier_score, location, bio, source, tags, is_placeholder, created_at, updated_at)
VALUES
  ('pp_01', 'Jensen Huang',        'Jensen',  'Founder & CEO',       'NVIDIA',            'nvidia.com',    'S', 99, 'Santa Clara, CA',  'Founder of NVIDIA; architect of the modern GPU and AI compute era.',      'manual', '["founder","ai","semi"]',     1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_02', 'Satya Nadella',       'Satya',   'Chairman & CEO',      'Microsoft',         'microsoft.com', 'S', 97, 'Redmond, WA',      'Led Microsoft''s enterprise cloud reinvention; steward of Azure + Copilot.', 'manual', '["ceo","cloud","ai"]',       1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_03', 'Sundar Pichai',       'Sundar',  'CEO',                 'Alphabet',          'abc.xyz',       'S', 95, 'Mountain View, CA','CEO of Alphabet; shepherds Search, Android, Gemini.',                       'manual', '["ceo","search","ai"]',      1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_04', 'Phạm Nhật Vượng',     'Vượng',   'Founder & Chairman',  'Vingroup',          'vingroup.net',  'S', 94, 'Hanoi, VN',        'Vietnam''s most successful entrepreneur; founder of Vingroup and VinFast.',  'manual', '["founder","vn-tech","auto"]', 1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_05', 'Lisa Su',             'Lisa',    'Chair & CEO',         'AMD',               'amd.com',       'A', 90, 'Austin, TX',       'Architect of AMD''s decade-long turnaround into silicon leadership.',        'manual', '["ceo","semi"]',              1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_06', 'Dario Amodei',        'Dario',   'Co-Founder & CEO',    'Anthropic',         'anthropic.com', 'A', 88, 'San Francisco, CA','Co-founder of Anthropic; frontier-AI safety research pioneer.',              'manual', '["founder","ai","safety"]',   1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_07', 'Patrick Collison',    'Patrick', 'Co-Founder & CEO',    'Stripe',            'stripe.com',    'A', 86, 'San Francisco, CA','Co-founder of Stripe; scaled internet-native payments and developer tooling.', 'manual', '["founder","fintech","dx"]', 1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_08', 'Trương Gia Bình',     'Bình',    'Founder & Chairman',  'FPT Corporation',   'fpt.com.vn',    'A', 85, 'Hanoi, VN',        'Founder of FPT; elder statesman of Vietnamese technology.',                  'manual', '["founder","vn-tech"]',       1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_09', 'Andrej Karpathy',     'Andrej',  'Founder',             'Eureka Labs',       'eurekalabs.ai', 'B', 80, 'San Francisco, CA','Founder of Eureka Labs; former Tesla / OpenAI; prolific AI educator.',        'manual', '["founder","ai","education"]', 1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_10', 'Chris Lattner',       'Chris',   'Co-Founder & CEO',    'Modular',           'modular.com',   'B', 78, 'Seattle, WA',      'Creator of LLVM + Swift; co-founder of Modular and the Mojo language.',      'manual', '["founder","compilers","ai"]', 1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_11', 'Guillermo Rauch',     'Rauch',   'Founder & CEO',       'Vercel',            'vercel.com',    'B', 76, 'San Francisco, CA','Founder of Vercel; shapes modern frontend infrastructure.',                  'manual', '["founder","frontend","dx"]', 1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_12', 'Nguyễn Hà Đông',      'Đông',    'Founder',             'dotGEARS',          'dotgears.com',  'B', 74, 'Hanoi, VN',        'Creator of Flappy Bird; elder of the Vietnamese indie-game scene.',          'manual', '["founder","games","vn-tech"]', 1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z');

-- Primary email + phone for each placeholder. Synthetic, non-routable values.
INSERT OR REPLACE INTO contact_channels (id, contact_id, kind, value, label, is_primary, created_at) VALUES
  ('pch_01_em', 'pp_01', 'email', 'jensen@demo.portrait',   'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_01_ph', 'pp_01', 'phone', '+00 000 000 0001',       'work', 0, '2026-04-21T00:00:00Z'),
  ('pch_02_em', 'pp_02', 'email', 'satya@demo.portrait',    'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_02_ph', 'pp_02', 'phone', '+00 000 000 0002',       'work', 0, '2026-04-21T00:00:00Z'),
  ('pch_03_em', 'pp_03', 'email', 'sundar@demo.portrait',   'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_03_ph', 'pp_03', 'phone', '+00 000 000 0003',       'work', 0, '2026-04-21T00:00:00Z'),
  ('pch_04_em', 'pp_04', 'email', 'vuong@demo.portrait',    'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_04_ph', 'pp_04', 'phone', '+00 000 000 0004',       'work', 0, '2026-04-21T00:00:00Z'),
  ('pch_05_em', 'pp_05', 'email', 'lisa@demo.portrait',     'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_06_em', 'pp_06', 'email', 'dario@demo.portrait',    'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_07_em', 'pp_07', 'email', 'patrick@demo.portrait',  'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_08_em', 'pp_08', 'email', 'binh@demo.portrait',     'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_09_em', 'pp_09', 'email', 'andrej@demo.portrait',   'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_10_em', 'pp_10', 'email', 'chris@demo.portrait',    'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_11_em', 'pp_11', 'email', 'rauch@demo.portrait',    'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_12_em', 'pp_12', 'email', 'dong@demo.portrait',     'work', 1, '2026-04-21T00:00:00Z');
