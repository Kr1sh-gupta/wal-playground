create table orders (
   id         serial primary key,
   product    text not null,
   amount     numeric(10,2),
   status     text default 'pending',
   created_at timestamptz default now()
);

create table inventory (
   product_id serial primary key,
   name       text not null,
   stock      integer default 100
);

insert into inventory (
   name,
   stock
) values ( 'Widget A',
           200 ),( 'Widget B',
                   150 ),( 'Widget C',
                           80 );

-- Trigger some WAL activity right at init
insert into orders (
   product,
   amount
) values ( 'Widget A',
           49.99 );
insert into orders (
   product,
   amount
) values ( 'Widget B',
           29.99 );
update inventory
   set
   stock = stock - 1
 where name = 'Widget A';