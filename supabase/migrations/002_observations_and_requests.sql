-- Additive migration. Existing sessions and consenting participant names are preserved.
begin;
create table if not exists public.verification_requests (
 id uuid primary key,
 session_id uuid not null unique references public.simulation_sessions(id) on delete cascade,
 patient_id text not null check (patient_id='PG-2048'),
 status text not null default 'pending-verification' check (status='pending-verification'),
 original_observation text not null,
 approved_observation text not null check(length(btrim(approved_observation)) between 1 and 1400),
 ai_review jsonb not null,
 payload jsonb not null,
 submitted_at timestamptz not null default now()
);
alter table public.verification_requests enable row level security;
revoke all on public.verification_requests from anon,authenticated;
grant all on public.verification_requests to service_role;
create or replace function public.submit_verification_request(session_id uuid,expected_version integer,new_payload jsonb,request_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.simulation_sessions%rowtype; existing_request public.verification_requests%rowtype;
begin
 select * into current_row from public.simulation_sessions where id=session_id for update;
 if not found then raise exception 'UNAUTHORIZED';end if;
 select * into existing_request from public.verification_requests r where r.session_id=submit_verification_request.session_id;
 if found then
  if existing_request.id::text <> request_payload->>'id' then raise exception 'CONFLICT';end if;
  return current_row.payload;
 end if;
 if current_row.version<>expected_version then raise exception 'CONFLICT';end if;
 if (current_row.payload#>>'{progress,workflowVersion}') is distinct from '2'
 or (current_row.payload#>>'{progress,identityVerified}') is distinct from 'true'
 or (current_row.payload#>>'{progress,procedureChecked}') is distinct from 'true'
 or (current_row.payload#>>'{progress,discrepancy}') is distinct from 'true'
 or (current_row.payload#>>'{progress,safeDecision}') is distinct from 'true'
 or (current_row.payload#>>'{progress,approvedReviewId}') is null
 or (current_row.payload#>>'{progress,request,id}') is distinct from (request_payload->>'id')
 or (current_row.payload#>>'{progress,approvedObservation}') is distinct from (request_payload->>'observation')
 or (request_payload->>'status') is distinct from 'pending-verification'
 or (new_payload#>>'{progress,completed}') is distinct from 'true'
 then raise exception 'REQUEST_NOT_READY';end if;
 insert into public.verification_requests(id,session_id,patient_id,status,original_observation,approved_observation,ai_review,payload,submitted_at)
 values((request_payload->>'id')::uuid,session_id,'PG-2048','pending-verification',current_row.payload#>>'{progress,observationOriginal}',request_payload->>'observation',current_row.payload#>'{progress,reviews}',request_payload,(request_payload->>'submittedAt')::timestamptz);
 update public.simulation_sessions set payload=new_payload,version=expected_version+1 where id=session_id;
 return new_payload;
end;
$$;
revoke all on function public.submit_verification_request(uuid,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.submit_verification_request(uuid,integer,jsonb,jsonb) to service_role;
commit;
