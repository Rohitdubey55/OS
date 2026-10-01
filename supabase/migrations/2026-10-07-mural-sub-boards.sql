-- Mural sub-boards: an element can open its own board.
alter table public.mural_elements add column if not exists link_project_id text;
alter table public.mural_projects add column if not exists parent_id text;
