export class MigrationsHistoryTableService {
    sql=`create table if not exists __migrations
(
	installed_rank integer not null
		constraint __migrations_pk
			primary key,
	version varchar(50),
	description varchar(200) not null,
	type varchar(20) not null,
	script varchar(1000) not null,
	checksum integer,
	installed_by varchar(100) not null,
	installed_on timestamp default now() not null,
	execution_time integer not null,
	success boolean not null
);

create index if not exists __migrations_s_idx
	on __migrations (success);
`
}