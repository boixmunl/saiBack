#!/bin/bash
#
# build_database.sh - create empty battery database schema for to log battery in.
#
# Tom Holderness 22/01/2012
sqlite3 piTemps.db 'CREATE TABLE battery_records(unix_time bigint primary key, celsius real);'