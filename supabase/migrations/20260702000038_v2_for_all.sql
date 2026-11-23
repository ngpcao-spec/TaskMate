-- D-114 (décision de Teo, 2026-11-23) : la V2 devient l'interface de TOUTES les familles. Nouvelle famille = v2 par défaut ; les familles
-- existantes encore en v1 passent en v2. Aucune donnée supprimée (seule la colonne d'affichage change ; l'administrateur peut toujours la régler).
alter table public.families alter column ui_version set default 'v2';
update public.families set ui_version = 'v2' where ui_version is distinct from 'v2';
