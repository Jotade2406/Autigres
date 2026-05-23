SET FOREIGN_KEY_CHECKS=0;
INSERT INTO graph_nodes (id, node_key, lat, lng, city, address_reference) VALUES
(1,'SCZ-N01',-17.78200000,-63.18200000,'Santa Cruz de la Sierra','Av. Monseñor Rivero y Av. Cristo Redentor'),
(2,'SCZ-N02',-17.78200000,-63.18000000,'Santa Cruz de la Sierra','Av. Monseñor Rivero y Av. Roca y Coronado'),
(3,'SCZ-N03',-17.78200000,-63.17800000,'Santa Cruz de la Sierra','Av. Monseñor Rivero y Radial 27'),
(4,'SCZ-N04',-17.78400000,-63.18200000,'Santa Cruz de la Sierra','Equipetrol Norte y Av. Cristo Redentor'),
(5,'SCZ-N05',-17.78400000,-63.18000000,'Santa Cruz de la Sierra','Equipetrol Norte y Av. Roca y Coronado'),
(6,'SCZ-N06',-17.78400000,-63.17800000,'Santa Cruz de la Sierra','Equipetrol Norte y Radial 27'),
(7,'SCZ-N07',-17.78600000,-63.18200000,'Santa Cruz de la Sierra','Av. San Martín y Av. Cristo Redentor'),
(8,'SCZ-N08',-17.78600000,-63.18000000,'Santa Cruz de la Sierra','Av. San Martín y Av. Roca y Coronado'),
(9,'SCZ-N09',-17.78600000,-63.17800000,'Santa Cruz de la Sierra','Av. San Martín y Radial 27'),
(10,'SCZ-N10',-17.78800000,-63.18200000,'Santa Cruz de la Sierra','Av. Santos Dumont y Av. Cristo Redentor');

INSERT INTO graph_edges (id, from_node_id, to_node_id, distance_meters, time_seconds_avg, road_name, is_bidirectional) VALUES
(1,1,2,190.00,55,'Calle 24 de Septiembre',1),
(2,2,3,190.00,55,'Calle 24 de Septiembre',1),
(3,4,5,190.00,55,'Calle Junín',1),
(4,5,6,190.00,55,'Calle Junín',1),
(5,7,8,190.00,55,'Av. Cañoto',1),
(6,8,9,190.00,55,'Av. Cañoto',1),
(7,1,4,222.00,65,'Av. Monseñor Rivero',1),
(8,4,7,222.00,65,'Av. Monseñor Rivero',1),
(9,7,10,222.00,65,'Av. Monseñor Rivero',1),
(10,2,5,222.00,65,'Calle Potosí',1),
(11,5,8,222.00,65,'Calle Potosí',1),
(12,3,6,222.00,65,'Calle Ballivián',1),
(13,6,9,222.00,65,'Calle Ballivián',1),
(14,1,5,302.00,85,'Atajo NW-Centro',0),
(15,5,9,302.00,85,'Atajo Centro-SE',0);
SET FOREIGN_KEY_CHECKS=1;
