# -*- coding: utf-8 -*-
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
os.environ["PATH"] += r";C:\Program Files\Graphviz\bin"
from graphviz import Digraph

dot = Digraph('ERD', format='png')
dot.attr(
    rankdir='LR',
    bgcolor='#1a1a2e',
    fontname='Helvetica',
    splines='ortho',
    nodesep='0.6',
    ranksep='1.4',
    dpi='150',
)

def table(name, fields):
    rows = (
        f'<TR><TD COLSPAN="3" BGCOLOR="#7c3aed" ALIGN="CENTER">'
        f'<FONT COLOR="white" POINT-SIZE="13"><B>{name}</B></FONT></TD></TR>'
    )
    for col, typ, flag in fields:
        bg = '#2d2d44' if flag == '' else '#252540'
        flag_color = {'PK': '#fbbf24', 'FK': '#60a5fa', 'UK': '#34d399'}.get(flag, '#94a3b8')
        flag_label = (
            f'<FONT COLOR="{flag_color}" POINT-SIZE="9"><B>{flag}</B></FONT>'
            if flag else ''
        )
        rows += (
            f'<TR>'
            f'<TD BGCOLOR="{bg}" ALIGN="LEFT" PORT="{col}">'
            f'<FONT COLOR="#e2e8f0" POINT-SIZE="10">{col}</FONT></TD>'
            f'<TD BGCOLOR="{bg}" ALIGN="LEFT">'
            f'<FONT COLOR="#94a3b8" POINT-SIZE="9">{typ}</FONT></TD>'
            f'<TD BGCOLOR="{bg}" ALIGN="CENTER" WIDTH="26">{flag_label}</TD>'
            f'</TR>'
        )
    return f'<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">{rows}</TABLE>>'

# ── Nodes ─────────────────────────────────────────────────────────────────────

dot.node('users', table('users', [
    ('id',           'int',       'PK'),
    ('uuid',         'char(36)',  'UK'),
    ('email',        'varchar',   'UK'),
    ('phone',        'varchar',   'UK'),
    ('first_name',   'varchar',   ''),
    ('last_name',    'varchar',   ''),
    ('role',         'enum',      ''),
    ('status',       'enum',      ''),
    ('created_at',   'timestamp', ''),
]), shape='none', margin='0')

dot.node('passengers', table('passengers', [
    ('id',                       'int',     'PK'),
    ('user_id',                  'int',     'FK'),
    ('rating_average',           'decimal', ''),
    ('total_trips',              'int',     ''),
    ('preferred_payment_method', 'enum',    ''),
]), shape='none', margin='0')

dot.node('drivers', table('drivers', [
    ('id',              'int',       'PK'),
    ('user_id',         'int',       'FK'),
    ('license_number',  'varchar',   'UK'),
    ('rating_average',  'decimal',   ''),
    ('total_trips',     'int',       ''),
    ('is_available',    'bool',      ''),
    ('is_online',       'bool',      ''),
    ('current_lat',     'decimal',   ''),
    ('current_lng',     'decimal',   ''),
    ('verified_at',     'timestamp', ''),
]), shape='none', margin='0')

dot.node('vehicles', table('vehicles', [
    ('id',           'int',     'PK'),
    ('driver_id',    'int',     'FK'),
    ('plate_number', 'varchar', 'UK'),
    ('brand',        'varchar', ''),
    ('model',        'varchar', ''),
    ('year',         'year',    ''),
    ('color',        'varchar', ''),
    ('capacity',     'tinyint', ''),
    ('is_active',    'bool',    ''),
]), shape='none', margin='0')

dot.node('trip_requests', table('trip_requests', [
    ('id',                  'int',       'PK'),
    ('uuid',                'char(36)',  'UK'),
    ('passenger_id',        'int',       'FK'),
    ('origin_address',      'varchar',   ''),
    ('destination_address', 'varchar',   ''),
    ('status',              'enum',      ''),
    ('estimated_fare',      'decimal',   ''),
    ('payment_method',      'varchar',   ''),
    ('service_tier',        'varchar',   ''),
    ('is_pooling_allowed',  'bool',      ''),
    ('expires_at',          'timestamp', ''),
    ('created_at',          'timestamp', ''),
]), shape='none', margin='0')

dot.node('trips', table('trips', [
    ('id',                  'int',       'PK'),
    ('uuid',                'char(36)',  'UK'),
    ('driver_id',           'int',       'FK'),
    ('vehicle_id',          'int',       'FK'),
    ('status',              'enum',      ''),
    ('origin_address',      'varchar',   ''),
    ('destination_address', 'varchar',   ''),
    ('base_fare',           'decimal',   ''),
    ('is_pooling_allowed',  'bool',      ''),
    ('payment_method',      'varchar',   ''),
    ('service_tier',        'varchar',   ''),
    ('arrived_at',          'datetime',  ''),
    ('started_at',          'timestamp', ''),
    ('completed_at',        'timestamp', ''),
    ('created_at',          'timestamp', ''),
]), shape='none', margin='0')

dot.node('trip_passengers', table('trip_passengers', [
    ('id',             'int',     'PK'),
    ('trip_id',        'int',     'FK'),
    ('passenger_id',   'int',     'FK'),
    ('request_id',     'int',     'FK'),
    ('pickup_address', 'varchar', ''),
    ('dropoff_address','varchar', ''),
    ('pickup_order',   'tinyint', ''),
    ('dropoff_order',  'tinyint', ''),
    ('fare_amount',    'decimal', ''),
    ('status',         'enum',    ''),
]), shape='none', margin='0')

dot.node('share_requests', table('share_requests', [
    ('id',                    'int',       'PK'),
    ('uuid',                  'char(36)',  'UK'),
    ('requester_request_id',  'int',       'FK'),
    ('target_request_id',     'int',       'FK'),
    ('combined_trip_id',      'int',       'FK'),
    ('status',                'int',       ''),
    ('expires_at',            'timestamp', ''),
    ('created_at',            'timestamp', ''),
]), shape='none', margin='0')

dot.node('ratings', table('ratings', [
    ('id',            'int',       'PK'),
    ('trip_id',       'int',       'FK'),
    ('rater_user_id', 'int',       'FK'),
    ('rated_user_id', 'int',       'FK'),
    ('score',         'tinyint',   ''),
    ('comment',       'text',      ''),
    ('created_at',    'timestamp', ''),
]), shape='none', margin='0')

dot.node('payments', table('payments', [
    ('id',                'int',      'PK'),
    ('uuid',              'char(36)', 'UK'),
    ('trip_passenger_id', 'int',      'FK'),
    ('amount',            'decimal',  ''),
    ('method',            'enum',     ''),
    ('status',            'enum',     ''),
    ('transaction_id',    'varchar',  'UK'),
    ('processed_at',      'timestamp',''),
]), shape='none', margin='0')

dot.node('notifications', table('notifications', [
    ('id',         'int',       'PK'),
    ('user_id',    'int',       'FK'),
    ('type',       'varchar',   ''),
    ('title',      'varchar',   ''),
    ('body',       'text',      ''),
    ('is_read',    'bool',      ''),
    ('created_at', 'timestamp', ''),
]), shape='none', margin='0')

dot.node('route_waypoints', table('route_waypoints', [
    ('id',             'int',     'PK'),
    ('trip_id',        'int',     'FK'),
    ('lat',            'decimal', ''),
    ('lng',            'decimal', ''),
    ('waypoint_type',  'varchar', ''),
    ('sequence_order', 'int',     ''),
]), shape='none', margin='0')

dot.node('graph_nodes', table('graph_nodes', [
    ('id',                'int',     'PK'),
    ('node_key',          'varchar', 'UK'),
    ('lat',               'decimal', ''),
    ('lng',               'decimal', ''),
    ('city',              'varchar', ''),
    ('address_reference', 'varchar', ''),
]), shape='none', margin='0')

dot.node('graph_edges', table('graph_edges', [
    ('id',               'int',      'PK'),
    ('from_node_id',     'int',      'FK'),
    ('to_node_id',       'int',      'FK'),
    ('distance_meters',  'decimal',  ''),
    ('time_seconds_avg', 'smallint', ''),
    ('road_name',        'varchar',  ''),
    ('is_bidirectional', 'bool',     ''),
]), shape='none', margin='0')

# ── Edges ─────────────────────────────────────────────────────────────────────
solid  = dict(color='#a78bfa', penwidth='1.8', arrowsize='0.7')
dashed = dict(color='#60a5fa', penwidth='1.2', arrowsize='0.7', style='dashed')

dot.edge('passengers:user_id',               'users:id',           **solid)
dot.edge('drivers:user_id',                  'users:id',           **solid)
dot.edge('vehicles:driver_id',               'drivers:id',         **solid)
dot.edge('notifications:user_id',            'users:id',           **dashed)
dot.edge('trip_requests:passenger_id',       'passengers:id',      **solid)
dot.edge('trips:driver_id',                  'drivers:id',         **solid)
dot.edge('trips:vehicle_id',                 'vehicles:id',        **solid)
dot.edge('trip_passengers:trip_id',          'trips:id',           **solid)
dot.edge('trip_passengers:passenger_id',     'passengers:id',      **solid)
dot.edge('trip_passengers:request_id',       'trip_requests:id',   **solid)
dot.edge('share_requests:requester_request_id','trip_requests:id', **solid)
dot.edge('share_requests:target_request_id', 'trip_requests:id',   **solid)
dot.edge('share_requests:combined_trip_id',  'trips:id',           **solid)
dot.edge('ratings:trip_id',                  'trips:id',           **dashed)
dot.edge('ratings:rater_user_id',            'users:id',           **dashed)
dot.edge('ratings:rated_user_id',            'users:id',           **dashed)
dot.edge('payments:trip_passenger_id',       'trip_passengers:id', **dashed)
dot.edge('route_waypoints:trip_id',          'trips:id',           **dashed)
dot.edge('graph_edges:from_node_id',         'graph_nodes:id',     **dashed)
dot.edge('graph_edges:to_node_id',           'graph_nodes:id',     **dashed)

os.makedirs('d:/Proyectos/work/Autigres/docs', exist_ok=True)
out = dot.render('d:/Proyectos/work/Autigres/docs/erd', cleanup=True)
print(f"Guardado: {out}")
