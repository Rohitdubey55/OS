-- One category list, everywhere: Personality, Ouro, Work, Enjoyment, Routine, Other.
--
-- Vision was written with its own hardcoded five (Personality, Ouro …) and the
-- Tasks category manager ended up holding Personal and Outh instead, so two
-- names that meant the same thing never matched and nothing linked across.
-- This renames the Tasks spellings to Vision's, everywhere a category is stored,
-- and sets the saved list to the six in order. Safe to run more than once.

BEGIN;

-- Tasks — which now includes every 10 Days Plan item.
UPDATE public.tasks         SET category = 'Personality' WHERE category = 'Personal';
UPDATE public.tasks         SET category = 'Ouro'        WHERE category = 'Outh';

UPDATE public.habits        SET category = 'Personality' WHERE category = 'Personal';
UPDATE public.habits        SET category = 'Ouro'        WHERE category = 'Outh';

UPDATE public.vision_board  SET category = 'Personality' WHERE category = 'Personal';
UPDATE public.vision_board  SET category = 'Ouro'        WHERE category = 'Outh';

-- Which category each Time Spent On card is linked to.
UPDATE public.time_categories SET task_category = 'Personality' WHERE task_category = 'Personal';
UPDATE public.time_categories SET task_category = 'Ouro'        WHERE task_category = 'Outh';

-- The master list, in your order. A 'VIEW:…|' prefix (the Tasks page's saved
-- view state) is kept as it was.
UPDATE public.settings
SET task_categories = CASE
    WHEN task_categories LIKE 'VIEW:%|%'
        THEN split_part(task_categories, '|', 1) || '|Personality,Ouro,Work,Enjoyment,Routine,Other'
    ELSE 'Personality,Ouro,Work,Enjoyment,Routine,Other'
END;

COMMIT;

-- What's still filed somewhere else. Anything listed here keeps showing up in
-- pickers — the app won't hide a category that something still uses — until
-- you re-file it. Empty result = everything is on your six.
SELECT 'task'   AS kind, category, count(*) AS how_many FROM public.tasks
 WHERE coalesce(category, '') NOT IN ('', 'Personality','Ouro','Work','Enjoyment','Routine','Other')
 GROUP BY category
UNION ALL
SELECT 'habit',  category, count(*) FROM public.habits
 WHERE coalesce(category, '') NOT IN ('', 'Personality','Ouro','Work','Enjoyment','Routine','Other')
 GROUP BY category
UNION ALL
SELECT 'vision', category, count(*) FROM public.vision_board
 WHERE coalesce(category, '') NOT IN ('', 'Personality','Ouro','Work','Enjoyment','Routine','Other')
 GROUP BY category
ORDER BY kind, how_many DESC;
