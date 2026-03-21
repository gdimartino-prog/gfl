/**
 * One-time script: import historical standings from pasted spreadsheet data.
 * Run with: POSTGRES_URL="..." npx tsx scripts/import-history.ts
 *
 * Logic:
 *  1. Match teams by name/teamshort (case-insensitive). Create new historical teams if not found.
 *  2. Update teams.coach from GM/Manager column if team currently has no coach set.
 *  3. Upsert standings rows (skip if (leagueId, teamId, year) already exists).
 */

import { db } from '../lib/db';
import { teams, standings } from '../schema';
import { eq, and } from 'drizzle-orm';

const LEAGUE_ID = 1;

const TSV_DATA = `Team	Year	Won	Lost	Tie	Pct	Offense Points	Offense	Defense Points	Defense	Diff	Divsion Win	Playoffs	Super Bowl	Super Bowl Win	Old Team Name	GM/Manager	Division
DC	2022	15	2	0	0.882	471	27.7	295	17.4	10.4	1	1	1	1		Alex Matsikoudis
Amalfi	2022	14	3	0	0.824	518	30.5	370	21.8	8.7	1	1				Adrian Scherer
Vico	2022	13	4	0	0.765	461	27.1	328	19.3	7.8	1	1				George Di Martino
Fur Peace	2022	13	4	0	0.765	521	30.6	415	24.4	6.2		1	1			Jack Wyville
Crimson	2022	12	5	0	0.706	422	24.8	265	15.6	9.2		1				Bob Glade
Kigali	2022	11	6	0	0.647	499	29.4	340	20	9.4		1				Bill Matsikoudis
London	2022	11	6	0	0.647	419	24.6	360	21.2	3.5		1				Matt Cicirelli
Carolina	2022	10	7	0	0.588	445	26.2	332	19.5	6.6						Pete Vuckovaz
Tampa	2022	9	8	0	0.529	478	28.1	392	23.1	5.1						Bill Kobus
Honolulu	2022	8	9	0	0.471	458	26.9	369	21.7	5.2						Rob Dunigan
Tetbury	2022	8	9	0	0.471	397	23.4	415	24.4	-1.1						Mike Fullen
Satriale	2022	7	10	0	0.412	374	22	398	23.4	-1.4						Tom Fusillo
Newark Bay	2022	6	11	0	0.353	367	21.6	451	26.5	-4.9						Phil Matsikoudis
Tinton Falls	2022	5	12	0	0.294	324	19.1	449	26.4	-7.4						Eddie White
Urban	2022	5	12	0	0.294	329	19.4	483	28.4	-9.1						John Yurchak
Old Bridge	2022	3	14	0	0.176	240	14.1	486	28.6	-14.5						Ed Casserly
Las Vegas	2022	3	14	0	0.176	216	12.7	467	27.5	-14.8						Mark Mari
LBI	2022	0	17	0	0	206	12.1	530	31.2	-19.1					Schrute Farms	Glenn Gardner
Honolulu	2021	13	3	0	0.813	476	29.8	284	17.8	12	1	1				Rob Dunigan
Vico	2021	13	3	0	0.813	468	29.3	278	17.4	11.9	1	1				George Di Martino
DC	2021	12	4	0	0.750	512	32	342	21.4	10.6		1	1	1		Alex Matsikoudis
Old Bridge	2021	12	4	0	0.750	476	29.8	308	19.3	10.5	1	1	1			Ed Casserly
Newark Bay	2021	11	5	0	0.688	511	31.9	363	22.7	9.3	1	1				Phil Matsikoudis
Crimson	2021	9	7	0	0.563	405	25.3	357	22.3	3		1				Bob Glade
Carolina	2021	9	7	0	0.563	454	28.4	449	28.1	0.3		1			Tempe	Pete Vuckovaz
Tampa	2021	8	8	0	0.500	427	26.7	362	22.6	4.1						Bill Kobus
New Orleans	2021	8	8	0	0.500	447	27.9	383	23.9	4						George Wyville
Kigali	2021	8	8	0	0.500	404	25.3	427	26.7	-1.4						Bill Matsikoudis
Satriale	2021	7	9	0	0.438	401	25.1	427	26.7	-1.6						Tom Fusillo
Joe C	2021	6	9	0	0.400	333	21.9	385	26.1	-4.3						Joe Cumputer
Tetbury	2021	5	11	0	0.313	360	22.5	506	31.6	-9.1					Interlaken	Mike Fullen
Amalfi	2021	4	12	0	0.250	288	18	491	30.7	-12.7						Adrian Scherer
Urban	2021	2	14	0	0.125	191	11.9	484	30.3	-18.3						John Yurchak
Joe C	2021	1	15	0	0.063	259	16.2	550	34.4	-18.2						Joe Cumputer
LBI	2021	0	1	0	0.000	17	17	33	33	-16					Schrute Farms	Glenn Gardner
Vico	2020	15	1	0	0.938	480	30	237	14.8	15.2	1	1	1	1		George Di Martino
Newark Bay	2020	13	3	0	0.813	445	27.8	276	17.3	10.6		1				Phil Matsikoudis
Carolina	2020	13	3	0	0.813	428	26.8	325	20.3	6.4	1	1	1		Tempe	Pete Vuckovaz
Crimson	2020	11	5	0	0.688	403	25.2	288	18	7.2	1	1				Bob Glade
New Orleans	2020	11	5	0	0.688	339	21.2	239	14.9	6.3		1				George Wyville
LBI	2020	11	5	0	0.688	427	26.7	362	22.6	4.1	1	1			LBI	Glenn Gardner
Old Bridge	2020	10	6	0	0.625	454	28.4	359	22.4	5.9		1				Ed Casserly
Urban	2020	7	9	0	0.438	314	19.6	364	22.8	-3.1						John Yurchak
DC	2020	7	9	0	0.438	323	20.2	418	26.1	-5.9						Alex Matsikoudis
Satriale	2020	6	10	0	0.375	347	21.7	377	23.6	-1.9						Tom Fusillo
Tampa	2020	6	10	0	0.375	346	21.6	402	25.1	-3.5						Bill Kobus
Kigali	2020	5	11	0	0.313	315	19.7	371	23.2	-3.5						Bill Matsikoudis
Tetbury	2020	4	12	0	0.250	314	19.6	450	28.1	-8.5					Interlaken	Mike Fullen
Honolulu	2020	4	12	0	0.250	339	21.2	501	31.3	-10.1						Rob Dunigan
Amalfi	2020	3	13	0	0.188	289	18.1	448	28	-9.9						Adrian Scherer
Fur Peace	2020	2	14	0	0.125	248	15.5	394	24.6	-9.1					Tinton Falls	Jack Wyville
LBI	2019	15	1	0	0.938	563	35.2	280	17.5	17.7	1	1	1	1	LBI	Glenn Gardner
Vico	2019	15	1	0	0.938	513	32.1	344	21.5	10.6	1	1	1			George Di Martino
Kigali	2019	13	3	0	0.813	487	30.4	381	23.8	6.6	1	1				Bill Matsikoudis
Carolina	2019	10	6	0	0.625	422	26.4	321	20.1	6.3		1			Tempe	Pete Vuckovaz
Old Bridge	2019	10	6	0	0.625	461	28.8	389	24.3	4.5		1				Ed Casserly
Amalfi	2019	9	7	0	0.563	441	27.6	412	25.8	1.8	1	1				Adrian Scherer
Newark Bay	2019	8	8	0	0.500	469	29.3	335	20.9	8.4						Phil Matsikoudis
Las Vegas	2019	8	8	0	0.500	401	25.1	378	23.6	1.4					Tipperarry	Mark Mari
Ocean City	2019	8	8	0	0.500	411	25.7	426	26.6	-0.9						August Daquila
Tetbury	2019	7	9	0	0.438	414	25.9	454	28.4	-2.5					Interlaken	Mike Fullen
Urban	2019	6	10	0	0.375	342	21.4	433	27.1	-5.7						John Yurchak
Fur Peace	2019	5	11	0	0.313	351	21.9	453	28.3	-6.4					Tinton Falls	Jack Wyville
DC	2019	5	11	0	0.313	365	22.8	505	31.6	-8.8						Alex Matsikoudis
Tampa	2019	5	11	0	0.313	338	21.1	505	31.6	-10.4						Bill Kobus
New Orleans	2019	2	14	0	0.125	330	20.6	479	29.9	-9.3						George Wyville
Crimson	2019	2	14	0	0.125	239	14.9	452	28.3	-13.3						Bob Glade
Newark Bay	2018	12	4	0	0.750	553	34.6	292	18.25	16.3		1				Phil Matsikoudis
LBI	2018	12	4	0	0.750	423	26.4	252	15.75	10.7	1	1	1	1	LBI	Glenn Gardner
Ocean City	2018	12	4	0	0.750	359	22.4	265	16.5625	5.9	1	1				August Daquila
Carolina	2018	11	5	0	0.688	459	28.7	322	20.125	8.6	1	1			Tempe	Pete Vuckovaz
Vico	2018	11	5	0	0.688	410	25.6	335	20.9375	4.7		1	1			George Di Martino
New Orleans	2018	11	5	0	0.688	373	23.3	303	18.9375	4.4						George Wyville
Fur Peace	2018	9	7	0	0.563	338	21.1	345	21.5625	-0.4	1	1			Tinton Falls	Jack Wyville
Tampa	2018	8	8	0	0.500	347	21.7	398	24.875	-3.2						Bill Kobus
Las Vegas	2018	7	8	0	0.467	304	20.3	334	22.26666667	-2					Tipperarry	Mark Mari
Old Bridge	2018	7	9	0	0.438	337	21.1	407	25.4375	-4.4						Ed Casserly
Crimson	2018	6	9	0	0.400	339	22.6	350	23.33333333	-0.7						Bob Glade
JC	2018	6	10	0	0.375	331	20.7	393	24.5625	-3.9						Tony Juskiewicz
Tetbury	2018	6	10	0	0.375	289	18.1	393	24.5625	-6.5					Interlaken	Mike Fullen
Kigali	2018	5	11	0	0.313	303	18.9	373	23.3125	-4.4						Bill Matsikoudis
Urban	2018	4	12	0	0.250	257	16.1	370	23.125	-7.1						John Yurchak
DC	2018	0	16	0	0.000	134	8.4	424	26.5	-18.1						Alex Matsikoudis
Fur Peace	2017	14	2	0	0.875	442	27.6	238	14.875	12.8	1	1	1	1	Tinton Falls	Jack Wyville
Newark Bay	2017	13	3	0	0.813	406	25.4	244	15.25	10.1	1	1	1			Phil Matsikoudis
Crimson	2017	13	3	0	0.813	411	25.7	300	18.75	6.9	1	1				Bob Glade
LBI	2017	11	5	0	0.688	341	21.3	299	18.6875	2.6		1			LBI	Glenn Gardner
Vico	2017	11	5	0	0.688	405	25.3	402	25.125	0.2		1				George Di Martino
Carolina	2017	10	6	0	0.625	364	22.8	281	17.5625	5.2		1			Tempe	Pete Vuckovaz
Kigali	2017	9	6	1	0.600	392	24.5	331	22.06666667	3.8						Bill Matsikoudis
Tetbury	2017	8	8	0	0.500	343	21.4	296	18.5	2.9					Interlaken	Mike Fullen
Urban	2017	7	9	0	0.438	343	21.4	357	22.3125	-0.9						John Yurchak
Ocean City	2017	6	9	1	0.400	263	16.4	338	22.53333333	-4.7						August Daquila
Tampa	2017	5	11	0	0.313	300	18.8	387	24.1875	-5.4						Bill Kobus
Old Bridge	2017	4	12	0	0.250	338	21.1	430	26.875	-5.8						Ed Casserly
Las Vegas	2017	3	13	0	0.188	245	15.3	330	20.625	-5.3					Tipperarry	Mark Mari
JC	2017	3	13	0	0.188	332	20.8	474	29.625	-8.9						Tony Juskiewicz
New Orleans	2017	2	14	0	0.125	242	15.1	460	28.75	-13.6						George Wyville
Kigali	2016	13	3	0	0.813	521	32.6	333	20.8125	11.8	1	1	1			Bill Matsikoudis
Ocean City	2016	13	3	0	0.813	476	29.8	360	22.5	7.3	1	1	1	1		August Daquila
Crimson	2016	12	4	0	0.750	520	32.5	443	27.6875	4.8	1	1				Bob Glade
New Orleans	2016	11	5	0	0.688	501	31.3	375	23.4375	7.9		1				George Wyville
Newark Bay	2016	10	6	0	0.625	555	34.7	478	29.875	4.8	1	1				Phil Matsikoudis
Fur Peace	2016	9	7	0	0.563	420	26.3	392	24.5	1.8					Tinton Falls	Jack Wyville
Tetbury	2016	9	7	0	0.563	416	26	407	25.4375	0.6		1			Interlaken	Mike Fullen
LBI	2016	8	8	0	0.500	389	24.3	397	24.8125	-0.5					LBI	Glenn Gardner
Tampa	2016	7	9	0	0.438	425	26.6	420	26.25	0.3						Bill Kobus
Old Bridge	2016	7	9	0	0.438	432	27	465	29.0625	-2.1						Ed Casserly
Edmonton	2016	7	9	0	0.438	353	22.1	407	25.4375	-3.4						Jeff Hunter
Urban	2016	6	10	0	0.375	461	28.8	481	30.0625	-1.3						John Yurchak
Bronx	2016	6	10	0	0.375	378	23.6	424	26.5	-2.9						Marty Gillian
Las Vegas	2016	6	10	0	0.375	396	24.8	449	28.0625	-3.3					Tipperarry	Mark Mari
Vico	2016	2	14	0	0.125	281	17.6	475	29.6875	-12.1	1	1				George Di Martino
Carolina	2016	2	14	0	0.125	311	19.4	529	33.0625	-13.6					Tempe	Pete Vuckovaz
LBI	2015	14	2	0	0.875	470	29.4	259	16.1875	13.2	1	1	1	1	LBI	Glenn Gardner
New Orleans	2015	14	2	0	0.875	421	26.3	241	15.0625	11.3	1	1	1			George Wyville
Tetbury	2015	11	5	0	0.688	414	25.9	320	20	5.9					Interlaken	Mike Fullen
Fur Peace	2015	11	5	0	0.688	403	25.2	326	20.375	4.8		1			Tinton Falls	Jack Wyville
Ocean City	2015	11	5	0	0.688	372	23.3	305	19.0625	4.2		1				August Daquila
Tampa	2015	10	6	0	0.625	484	30.3	379	23.6875	6.6	1	1				Bill Kobus
Vico	2015	8	8	0	0.500	385	24.1	370	23.125	0.9						George Di Martino
Newark Bay	2015	7	9	0	0.438	397	24.8	385	24.0625	0.8						Phil Matsikoudis
Carolina	2015	7	9	0	0.438	361	22.6	399	24.9375	-2.4					Tempe	Pete Vuckovaz
Urban	2015	6	10	0	0.375	387	24.2	397	24.8125	-0.6						John Yurchak
Pomerol	2015	6	10	0	0.375	351	21.9	409	25.5625	-3.6						John Matsikoudis
Crimson	2015	6	10	0	0.375	314	19.6	453	28.3125	-8.7						Bob Glade
Kigali	2015	5	11	0	0.313	359	22.4	460	28.75	-6.3						Bill Matsikoudis
Edmonton	2015	4	12	0	0.250	332	20.8	419	26.1875	-5.4						Jeff Hunter
Bucks County	2015	4	12	0	0.250	344	21.5	499	31.1875	-9.7						Mo Alfifi
Las Vegas	2015	4	12	0	0.250	256	16	429	26.8125	-10.8					Tipperarry	Mark Mari
Carolina	2014	13	3	0	0.813	523	32.7	341	21.3125	11.4	1	1	1	1	Tempe	Pete Vuckovaz
Ocean City	2014	13	3	0	0.813	373	23.3	245	15.3125	8	1	1	1			August Daquila
New Orleans	2014	12	4	0	0.750	355	22.2	326	20.375	1.8		1				George Wyville
Tampa	2014	11	5	0	0.688	462	28.9	306	19.125	9.8	1	1				Bill Kobus
Newark Bay	2014	9	7	0	0.563	434	27.1	335	20.9375	6.2		1				Phil Matsikoudis
Fur Peace	2014	9	7	0	0.563	324	20.3	289	18.0625	2.2					Tinton Falls	Jack Wyville
Tetbury	2014	9	7	0	0.563	338	21.1	412	25.75	-4.6	1	1			Interlaken	Mike Fullen
Crimson	2014	8	8	0	0.500	358	22.4	324	20.25	2.1						Bob Glade
Nutley	2014	8	8	0	0.500	373	23.3	376	23.5	-0.2						Bill O'Donnell
Las Vegas	2014	7	9	0	0.438	270	16.9	405	25.3125	-8.4					Tipperarry	Mark Mari
Urban	2014	6	10	0	0.375	346	21.6	366	22.875	-1.3						John Yurchak
Pomerol	2014	6	10	0	0.375	349	21.8	371	23.1875	-1.4						John Matsikoudis
JC	2014	5	11	0	0.313	367	22.9	393	24.5625	-1.6						Tony Juskiewicz
Kigali	2014	5	11	0	0.313	312	19.5	433	27.0625	-7.6						Bill Matsikoudis
Vico	2014	4	12	0	0.250	324	20.3	433	27.0625	-6.8						George Di Martino
LBI	2014	3	13	0	0.188	301	18.8	454	28.375	-9.6					LBI	Glenn Gardner
Crimson	2013	12	4	0	0.750	402	25.1	277	17.3125	7.8	1	1				Bob Glade
Newark Bay	2013	11	5	0	0.688	491	30.7	331	20.6875	10		1				Phil Matsikoudis
New Orleans	2013	11	5	0	0.688	408	25.5	282	17.625	7.9			1	1		George Wyville
Ocean City	2013	11	5	0	0.688	394	24.6	388	24.25	0.4		1				August Daquila
Tampa	2013	10	6	0	0.625	440	27.5	323	20.1875	7.3		1				Bill Kobus
Carolina	2013	10	6	0	0.625	394	24.6	315	19.6875	4.9		1			Tempe	Pete Vuckovaz
Urban	2013	10	6	0	0.625	376	23.5	334	20.875	2.6						John Yurchak
Vico	2013	10	6	0	0.625	349	21.8	318	19.875	1.9		1				George Di Martino
Thermopylae	2013	9	7	0	0.563	385	24.1	387	24.1875	-0.1						Aurelio Vincitore
LBI	2013	8	8	0	0.500	332	20.8	376	23.5	-2.8					LBI	Glenn Gardner
Las Vegas	2013	7	9	0	0.438	358	22.4	346	21.625	0.8					Tipperarry	Mark Mari
Fur Peace	2013	7	9	0	0.438	318	19.9	368	23	-3.1					Tinton Falls	Jack Wyville
Pomerol	2013	5	11	0	0.313	325	20.3	404	25.25	-4.9						John Matsikoudis
Tetbury	2013	5	11	0	0.313	277	17.3	432	27	-9.7					Interlaken	Mike Fullen
Nutley	2013	4	12	0	0.250	274	17.1	356	22.25	-5.1						Bill O'Donnell
Kigali	2013	4	12	0	0.250	292	18.3	427	26.6875	-8.4						Bill Matsikoudis
JC	2013	2	14	0	0.125	301	18.8	452	28.25	-9.4						Tony Juskiewicz
Edmonton	2012	13	3	0	0.813	538	33.6	289	18.0625	15.6	1	1				Jeff Hunter
Fur Peace	2012	13	3	0	0.813	437	27.3	260	16.25	11.1	1	1			Tinton Falls	Jack Wyville
Ocean City	2012	12	4	0	0.750	411	25.7	265	16.5625	9.1	1	1				August Daquila
LBI	2012	12	4	0	0.750	409	25.6	290	18.125	7.4	1	1	1	1	LBI	Glenn Gardner
Tampa	2012	11	5	0	0.688	422	26.4	330	20.625	5.8		1				Bill Kobus
Vico	2012	11	5	0	0.688	386	24.1	302	18.875	5.3		1				George Di Martino
Crimson	2012	11	5	0	0.688	359	22.4	313	19.5625	2.9		1				Bob Glade
Newark Bay	2012	10	6	0	0.625	476	29.8	410	25.625	4.1		1				Phil Matsikoudis
New Orleans	2012	10	6	0	0.625	382	23.9	323	20.1875	3.7		1	1			George Wyville
Urban	2012	9	7	0	0.563	397	24.8	335	20.9375	3.9		1				John Yurchak
JC	2012	7	9	0	0.438	345	21.6	352	22	-0.4						Tony Juskiewicz
Bermuda	2012	7	9	0	0.438	293	18.3	341	21.3125	-3						Shane Haverstick
Nutley	2012	6	10	0	0.375	325	20.3	326	20.375	-0.01						Bill O'Donnell
Pomerol	2012	5	11	0	0.313	340	21.3	363	22.6875	-1.4						John Matsikoudis
Las Vegas	2012	5	11	0	0.313	269	16.8	400	25	-8.2					Tipperarry	Mark Mari
Carolina	2012	4	12	0	0.250	261	16.3	386	24.125	-7.8					Tempe	Pete Vuckovaz
Kigali	2012	3	13	0	0.188	296	18.5	481	30.0625	-11.6						Bill Matsikoudis
Tetbury	2012	2	14	0	0.125	194	12.1	527	32.9375	-20.8					Interlaken	Mike Fullen
Thermopylae	2012	1	15	0	0.063	172	10.8	419	26.1875	-15.4						Aurelio Vincitore
Newark Bay	2011	12	4	0	0.750	398	24.9	246	15.375	9.5	1	1				Phil Matsikoudis
Pomerol	2011	12	4	0	0.750	392	24.5	272	17	7.5	1	1	1	1		John Matsikoudis
Carolina	2011	12	4	0	0.750	349	21.8	261	16.3125	5.5		1			Tempe	Pete Vuckovaz
New Orleans	2011	11	5	0	0.688	386	24.1	268	16.75	7.4	1	1				George Wyville
Crimson	2011	11	5	0	0.688	334	20.9	271	16.9375	3.9		1				Bob Glade
Ocean City	2011	11	5	0	0.688	361	22.6	313	19.5625	3	1	1				August Daquila
LBI	2011	10	6	0	0.625	405	25.3	313	19.5625	5.8		1	1		LBI	Glenn Gardner
Tampa	2011	10	6	0	0.625	335	20.9	258	16.125	4.8		1				Bill Kobus
Fur Peace	2011	10	6	0	0.625	334	20.9	282	17.625	3.3		1			Tinton Falls	Jack Wyville
Vico	2011	9	7	0	0.563	325	20.3	262	16.375	3.9						George Di Martino
Edmonton	2011	8	8	0	0.500	324	20.3	356	22.25	-2						Jeff Hunter
Bermuda	2011	7	9	0	0.438	345	21.6	357	22.3125	-0.8						Shane Haverstick
Urban	2011	7	9	0	0.438	265	16.6	289	18.0625	-1.5						John Yurchak
JC	2011	7	9	0	0.438	271	16.9	347	21.6875	-4.8						Tony Juskiewicz
Thermopylae	2011	6	10	0	0.375	294	18.4	374	23.375	-5						Aurelio Vincitore
Nutley	2011	5	11	0	0.313	358	22.4	379	23.6875	-1.3						Bill O'Donnell
Kigali	2011	3	13	0	0.188	266	16.6	405	25.3125	-8.7						Bill Matsikoudis
Tetbury	2011	1	15	0	0.063	214	13.4	461	28.8125	-15.4					Interlaken	Mike Fullen
Las Vegas	2011	0	16	0	0.000	178	11.1	420	26.25	-15.1					Tipperarry	Mark Mari
Fur Peace	2010	15	1	0	0.938	428	26.8	220	13.75	13	1	1			Tinton Falls	Jack Wyville
Newark Bay	2010	12	4	0	0.750	510	31.9	325	20.3125	11.6	1	1	1	1		Phil Matsikoudis
Pomerol	2010	11	5	0	0.688	427	26.7	287	17.9375	8.8		1				John Matsikoudis
Carolina	2010	11	5	0	0.688	360	22.5	223	13.9375	8.6		1	1		Tempe	Pete Vuckovaz
Crimson	2010	11	5	0	0.688	413	25.8	292	18.25	7.6		1				Bob Glade
Ocean City	2010	10	6	0	0.625	321	20.1	317	19.8125	0.3		1				August Daquila
Tampa	2010	9	7	0	0.563	377	23.6	349	21.8125	1.8		1				Bill Kobus
Kigali	2010	9	7	0	0.563	375	23.4	383	23.9375	-0.5						Bill Matsikoudis
Vico	2010	9	7	0	0.563	327	20.4	375	23.4375	-3	1	1				George Di Martino
Edmonton	2010	8	8	0	0.500	376	23.5	345	21.5625	1.9						Jeff Hunter
JC	2010	8	8	0	0.500	392	24.5	409	25.5625	-1.1						Tony Juskiewicz
LBI	2010	7	9	0	0.438	416	26	385	24.0625	1.9					LBI	Glenn Gardner
New Orleans	2010	7	9	0	0.438	360	22.5	351	21.9375	0.6						George Wyville
Nutley	2010	5	11	0	0.313	333	20.8	418	26.125	-5.3						Bill O'Donnell
Bermuda	2010	4	12	0	0.250	348	21.8	466	29.125	-7.4						Shane Haverstick
Montvale	2010	4	12	0	0.250	316	19.8	507	31.6875	-11.9						Tommy Carlock
Urban	2010	3	13	0	0.188	334	20.9	439	27.4375	-6.6						John Yurchak
Tetbury	2010	1	15	0	0.063	195	12.2	517	32.3125	-20.1					Interlaken	Mike Fullen
New Orleans	2009	14	2	0	0.875	416	26	243	15.1875	10.8		1				George Wyville
Ocean City	2009	14	2	0	0.875	365	22.8	199	12.4375	10.4	1	1				August Daquila
Crimson	2009	13	3	0	0.813	445	27.8	270	16.875	10.9		1	1	1		Bob Glade
Edmonton	2009	10	6	0	0.625	378	23.6	290	18.125	5.5		1				Jeff Hunter
Guttenberg	2009	10	6	0	0.625	312	19.5	277	17.3125	2.2		1	1			Rob Mattessich
Tampa	2009	8	8	0	0.500	331	20.7	318	19.875	0.8		1				Bill Kobus
Newark Bay	2009	8	8	0	0.500	347	21.7	350	21.875	-0.2						Phil Matsikoudis
Fur Peace	2009	8	8	0	0.500	321	20.1	328	20.5	-0.4		1			Tinton Falls	Jack Wyville
Carolina	2009	7	9	0	0.438	319	19.9	327	20.4375	-0.5					Tempe	Pete Vuckovaz
LBI	2009	7	9	0	0.438	289	18.1	299	18.6875	-0.6					LBI	Glenn Gardner
Pomerol	2009	7	9	0	0.438	279	17.4	305	19.0625	-1.6						John Matsikoudis
Bermuda	2009	7	9	0	0.438	328	20.5	357	22.3125	-1.8						Shane Haverstick
Vico	2009	6	10	0	0.375	267	16.7	311	19.4375	-2.8						George Di Martino
JC	2009	6	10	0	0.375	321	20.1	495	30.9375	-10.9						Tony Juskiewicz
Kigali	2009	4	12	0	0.250	287	17.9	420	26.25	-8.3						Bill Matsikoudis
Urban	2009	4	12	0	0.250	242	15.1	379	23.6875	-8.6						John Yurchak
Montvale	2009	3	13	0	0.188	276	17.3	355	22.1875	-4.9						Tommy Carlock
Ocean City	2008	15	1	0	0.938	402	25.1	219	13.6875	11.4	1	1	1			August Daquila
Edmonton	2008	15	1	0	0.938	401	25.1	222	13.875	11.2		1				Jeff Hunter
Fur Peace	2008	13	3	0	0.813	404	25.3	211	13.1875	12.1		1	1	1	Tinton Falls	Jack Wyville
Pomerol	2008	12	4	0	0.750	372	23.3	251	15.6875	7.6		1				John Matsikoudis
Newark Bay	2008	11	5	0	0.688	442	27.6	331	20.6875	6.9		1				Phil Matsikoudis
New Orleans	2008	10	6	0	0.625	334	20.9	226	14.125	6.8		1				George Wyville
Vico	2008	8	8	0	0.500	287	17.9	267	16.6875	1.3		1				George Di Martino
Crimson	2008	7	9	0	0.438	261	16.3	278	17.375	-1.1						Bob Glade
Tampa	2008	7	9	0	0.438	255	15.9	282	17.625	-1.7						Bill Kobus
Carolina	2008	7	9	0	0.438	336	21	381	23.8125	-2.8					Tempe	Pete Vuckovaz
Urban	2008	7	9	0	0.438	285	17.8	347	21.6875	-3.9						John Yurchak
LBI	2008	6	10	0	0.375	265	16.6	300	18.75	-2.2					LBI	Glenn Gardner
Montvale	2008	4	12	0	0.250	246	15.4	343	21.4375	-6.1						Tommy Carlock
Kigali	2008	4	12	0	0.250	251	15.7	424	26.5	-10.8						Bill Matsikoudis
Bermuda	2008	4	12	0	0.250	199	12.4	382	23.875	-11.4						Shane Haverstick
JC	2008	3	13	0	0.188	278	17.4	401	25.0625	-7.7						Tony Juskiewicz
Guttenberg	2008	3	13	0	0.188	201	12.6	354	22.125	-9.6						Rob Mattessich
Newark Bay	2007	14	2	0	0.875	466	29.1	284	17.75	11.4	1	1				Phil Matsikoudis
LBI	2007	13	3	0	0.813	526	32.9	282	17.625	15.3		1			LBI	Glenn Gardner
Edmonton	2007	13	3	0	0.813	474	29.6	253	15.8125	13.8		1				Jeff Hunter
Carolina	2007	12	4	0	0.750	501	31.3	257	16.0625	15.3		1	1	1	Tempe	Pete Vuckovaz
Pomerol	2007	11	5	0	0.688	420	26.3	226	14.125	12.1		1				John Matsikoudis
Ocean City	2007	11	5	0	0.688	395	24.7	281	17.5625	7.1		1	1			August Daquila
Vico	2007	9	7	0	0.563	307	19.2	277	17.3125	1.9		1				George Di Martino
Kigali	2007	9	7	0	0.563	299	18.7	316	19.75	-1.1		1				Bill Matsikoudis
Urban	2007	7	9	0	0.438	378	23.6	367	22.9375	0.7						John Yurchak
Guttenberg	2007	7	9	0	0.438	263	16.4	304	19	-2.6						Rob Mattessich
Crimson	2007	6	10	0	0.375	250	15.6	319	19.9375	-4.3						Bob Glade
Fur Peace	2007	6	10	0	0.375	291	18.2	402	25.125	-6.9					Tinton Falls	Jack Wyville
Buckingham	2007	5	11	0	0.313	263	16.4	390	24.375	-7.9						Garry Bily
Tampa	2007	5	11	0	0.313	275	17.2	444	27.75	-10.6						Bill Kobus
JC	2007	4	12	0	0.250	263	16.4	356	22.25	-5.8						Tony Juskiewicz
New Orleans	2007	4	12	0	0.250	229	14.3	405	25.3125	-11						George Wyville
Bermuda	2007	0	16	0	0.000	176	11	613	38.3125	-27.3						Shane Haverstick
LBI	2006	15	1	0	0.938	590	36.9	156	9.75	27.1	1	1	1	1	LBI	Glenn Gardner
Pomerol	2006	13	3	0	0.813	455	28.4	236	14.75	13.7	1	1				John Matsikoudis
Carolina	2006	12	4	0	0.750	413	25.8	245	15.3125	10.5		1			Tempe	Pete Vuckovaz
Newark Bay	2006	12	4	0	0.750	515	32.2	377	23.5625	8.6	1	1	1			Phil Matsikoudis
Ocean City	2006	11	5	0	0.688	366	22.9	277	17.3125	5.6		1				August Daquila
Edmonton	2006	10	6	0	0.625	408	25.5	291	18.1875	7.3						Jeff Hunter
Tampa	2006	10	6	0	0.625	365	22.8	257	16.0625	6.8	1	1				Bill Kobus
Fur Peace	2006	10	6	0	0.625	352	22	306	19.125	2.9					Tinton Falls	Jack Wyville
JC	2006	9	7	0	0.563	371	23.2	373	23.3125	-0.1						Tony Juskiewicz
Urban	2006	8	8	0	0.500	318	19.9	366	22.875	-3						John Yurchak
Vico	2006	6	10	0	0.375	320	20	382	23.875	-3.9						George Di Martino
New Orleans	2006	6	10	0	0.375	289	18.1	372	23.25	-5.2						George Wyville
Kigali	2006	2	14	0	0.125	298	18.6	458	28.625	-10						Bill Matsikoudis
Crimson	2006	2	14	0	0.125	177	11.1	461	28.8125	-17.8						Bob Glade
Guttenberg	2006	1	15	0	0.063	151	9.4	422	26.375	-16.9						Rob Mattessich
Buckingham	2006	1	15	0	0.063	189	11.8	598	37.375	-25.6						Garry Bily
Carolina	2005	15	3	0	0.833	524	29.1	379	21.05555556	6.9	1	1	1	1	Tempe	Pete Vuckovaz
LBI	2005	14	4	0	0.778	530	30.1	375	20.83333333	9.1	1	1	1		LBI	Glenn Gardner
Newark Bay	2005	13	4	0	0.765	560	34.8	341	20.05882353	14.3	1	1				Phil Matsikoudis
Las Vegas	2005	11	6	0	0.647	561	34.1	284	16.70588235	18.4					Tipperarry	Mark Mari
Ocean City	2005	11	7	0	0.611	450	25.6	470	26.11111111	-0.3		1				August Daquila
Kigali	2005	11	7	0	0.611	423	24.4	442	24.55555556	-1.1		1				Bill Matsikoudis
Pomerol	2005	9	7	0	0.563	494	30.9	411	25.6875	5.2						John Matsikoudis
Urban	2005	8	8	0	0.500	441	27.6	416	26	1.6						John Yurchak
New Orleans	2005	7	9	0	0.438	410	25.6	412	25.75	-0.1						George Wyville
Tampa	2005	6	10	0	0.375	408	25.5	403	25.1875	0.3						Bill Kobus
Fur Peace	2005	6	10	0	0.375	278	17.4	408	25.5	-8.1					Tinton Falls	Jack Wyville
Crimson	2005	5	11	0	0.313	292	18.3	382	23.875	-5.6						Bob Glade
JC	2005	4	12	0	0.250	262	16.4	476	29.75	-13.4						Tony Juskiewicz
Vico	2005	3	13	0	0.188	286	17.9	415	25.9375	-8.1						George Di Martino
Buckingham	2005	2	14	0	0.125	206	12.9	511	31.9375	-19.1						Garry Bily
Pomerol	2004	14	2	0	0.875	565	35.3	322	20.125	15.2	1	1	1	1		John Matsikoudis
Tampa	2004	12	4	0	0.750	487	30.4	302	18.875	11.6	1	1	1			Bill Kobus
Carolina	2004	12	4	0	0.750	367	22.9	292	18.25	4.7		1			Tempe	Pete Vuckovaz
LBI	2004	11	5	0	0.688	446	27.9	323	20.1875	7.7		1			LBI	Glenn Gardner
Vico	2004	11	5	0	0.688	421	26.3	311	19.4375	6.9		1				George Di Martino
Ocean City	2004	11	5	0	0.688	414	25.9	321	20.0625	5.8		1				August Daquila
Newark Bay	2004	8	8	0	0.500	466	29.1	418	26.125	3						Phil Matsikoudis
Las Vegas	2004	7	9	0	0.438	301	18.8	324	20.25	-1.4					Tipperarry	Mark Mari
Edmonton	2004	6	10	0	0.375	340	21.3	349	21.8125	-0.6						Jeff Hunter
Kigali	2004	6	10	0	0.375	338	21.1	410	25.625	-4.5						Bill Matsikoudis
JC	2004	6	10	0	0.375	305	19.1	395	24.6875	-5.6						Tony Juskiewicz
Urban	2004	4	12	0	0.250	330	20.6	499	31.1875	-10.6						John Yurchak
Fur Peace	2004	3	13	0	0.188	251	15.7	518	32.375	-16.7					Tinton Falls	Jack Wyville
Crimson	2004	1	15	0	0.063	206	12.9	453	28.3125	-15.4						Bob Glade
Vico	2003	14	2	0	0.875	412	25.8	283	17.6875	8.1	1	1	1	1		George Di Martino
LBI	2003	12	4	0	0.750	455	28.4	243	15.1875	13.3					LBI	Glenn Gardner
Pomerol	2003	11	5	0	0.688	403	25.2	269	16.8125	8.4	1	1				John Matsikoudis
Kigali	2003	11	5	0	0.688	410	25.6	279	17.4375	8.2		1				Bill Matsikoudis
Newark Bay	2003	10	6	0	0.625	362	22.6	265	16.5625	6.1		1				Phil Matsikoudis
Ocean City	2003	10	6	0	0.625	410	25.6	317	19.8125	5.8	1	1	1			August Daquila
Urban	2003	10	6	0	0.625	379	23.7	397	24.8125	-1.1						John Yurchak
Las Vegas	2003	7	9	0	0.438	404	25.3	400	25	0.3					Tipperarry	Mark Mari
Carolina	2003	6	10	0	0.375	355	22.2	435	27.1875	-5					Tempe	Pete Vuckovaz
Edmonton	2003	5	11	0	0.313	250	15.6	399	24.9375	-9.3						Jeff Hunter
JC	2003	4	12	0	0.250	322	20.1	429	26.8125	-6.7						Tony Juskiewicz
Tampa	2003	3	13	0	0.188	291	18.2	407	25.4375	-7.3						Bill Kobus
Crimson	2003	1	15	0	0.063	191	11.9	521	32.5625	-20.6						Bob Glade
Tampa	2002	13	3	0	0.813	410	25.6	273	17.0625	8.6	1	1				Bill Kobus
Vico	2002	12	4	0	0.750	424	26.5	264	16.5	10		1	1	1		George Di Martino
Newark Bay	2002	11	5	0	0.688	358	22.4	215	13.4375	8.9		1	1			Phil Matsikoudis
Carolina	2002	11	5	0	0.688	385	24.1	338	21.125	2.9	1	1			Tempe	Pete Vuckovaz
LBI	2002	10	6	0	0.625	336	21	234	14.625	6.4					LBI	Glenn Gardner
Urban	2002	8	8	0	0.500	369	23.1	312	19.5	3.6						John Yurchak
Kigali	2002	8	8	0	0.500	258	16.1	295	18.4375	-2.3						Bill Matsikoudis
Pomerol	2002	7	9	0	0.438	409	25.6	366	22.875	2.7						John Matsikoudis
Ocean City	2002	7	9	0	0.438	347	21.7	325	20.3125	1.4						August Daquila
Las Vegas	2002	7	9	0	0.438	290	18.1	361	22.5625	-4.4					Tipperarry	Mark Mari
Edmonton	2002	2	14	0	0.125	187	11.7	419	26.1875	-14.5						Jeff Hunter
JC	2002	0	16	0	0.000	160	10	531	33.1875	-23.2						Tony Juskiewicz
LBI	2001	14	0	0	1.000	428	30.6	188	13.42857143	17.1	1	1	1	1	LBI	Glenn Gardner
Ocean City	2001	9	5	0	0.643	311	22.2	318	22.71428571	-0.5	1	1				August Daquila
Pomerol	2001	8	6	0	0.571	323	23.1	303	21.64285714	1.4		1	1			John Matsikoudis
Carolina	2001	7	7	0	0.500	404	28.9	340	24.28571429	4.6		1			Tempe	Pete Vuckovaz
Vico	2001	7	7	0	0.500	353	25.2	357	25.5	-0.3		1				George Di Martino
Tampa	2001	6	8	0	0.429	366	26.1	336	24	2.1						Bill Kobus
Kigali	2001	6	8	0	0.429	294	21	333	23.78571429	-2.8						Bill Matsikoudis
Las Vegas	2001	5	9	0	0.357	252	18	314	22.42857143	-4.4					Tipperarry	Mark Mari
Urban	2001	4	10	0	0.286	248	17.7	339	24.21428571	-6.5						John Yurchak
Newark Bay	2001	4	10	0	0.286	287	20.5	438	31.28571429	-10.8						Phil Matsikoudis
LBI	2000	12	2	0	0.857	410	29.3	278	19.85714286	9.4	1	1			LBI	Glenn Gardner
Ocean City	2000	11	3	0	0.786	382	27.3	319	22.78571429	4.5		1	1			August Daquila
Vico	2000	10	4	0	0.714	458	32.7	326	23.28571429	9.4	1	1				George Di Martino
Carolina	2000	7	7	0	0.500	393	28.1	336	24	4.1		1			Tempe	Pete Vuckovaz
Newark Bay	2000	7	7	0	0.500	380	27.1	329	23.5	3.6		1	1	1		Phil Matsikoudis
Urban	2000	7	7	0	0.500	385	27.5	387	27.64285714	-0.1		1				John Yurchak
Pomerol	2000	6	8	0	0.429	438	31.3	414	29.57142857	1.7						John Matsikoudis
Kigali	2000	4	10	0	0.286	354	25.3	455	32.5	-7.2						Bill Matsikoudis
Tampa	2000	4	10	0	0.286	249	17.8	355	25.35714286	-7.6						Bill Kobus
Las Vegas	2000	2	12	0	0.143	213	15.2	463	33.07142857	-17.9					Tipperarry	Mark Mari
Newark Bay	1999	14	2	0	0.875	505	31.6	290	18.125	13.4	1	1	1	1		Phil Matsikoudis
Ocean City	1999	11	5	0	0.688	428	26.8	311	19.4375	7.3		1				August Daquila
Pomerol	1999	9	7	0	0.563	373	23.3	405	25.3125	-2		1	1			John Matsikoudis
Kigali	1999	8	8	0	0.500	483	30.2	448	28	2.2		1				Bill Matsikoudis
Vico	1999	8	8	0	0.500	420	26.3	394	24.625	1.6		1				George Di Martino
Urban	1999	7	9	0	0.438	388	24.3	397	24.8125	-0.6						John Yurchak
LBI	1999	7	9	0	0.438	390	24.4	459	28.6875	-4.3					LBI	Glenn Gardner
Tampa	1999	4	12	0	0.250	377	23.6	505	31.5625	-8						Bill Kobus
Carolina	1999	4	12	0	0.250	311	19.4	466	29.125	-9.7					Tempe	Pete Vuckovaz
Newark Bay	1998	9	1	0	0.900	322	32.2	213	21.3	0	1	1	1			Phil Matsikoudis
Pomerol	1998	8	2	0	0.800	302	30.2	198	19.8	0		1	1	1		John Matsikoudis
Urban	1998	7	3	0	0.700	298	29.8	213	21.3	0	1	1				John Yurchak
Kigali	1998	6	4	0	0.600	212	21.2	205	20.5	0						Bill Matsikoudis
Ocean City	1998	4	6	0	0.400	240	24	247	24.7	0	1	1				August Daquila
LBI	1998	4	6	0	0.400	258	25.8	257	25.7	0					LBI	Glenn Gardner
Garfield	1998	3	7	0	0.300	181	18.1	235	23.5	0						Marty Yurchak
Vico	1998	2	8	0	0.200	143	14.3	248	24.8	0						George Di Martino
Carolina	1998	2	8	0	0.200	188	18.8	235	23.5	0					Tempe	Pete Vuckovaz
Kigali	1997	8	2	0	0.800	347	34.7	244	24.4	0	1	1				Bill Matsikoudis
Pomerol	1997	6	4	0	0.600	260	26	209	20.9	0		1	1			John Matsikoudis
Newark Bay	1997	6	4	0	0.600	290	29	218	21.8	0	1	1				Phil Matsikoudis
Vico	1997	5	5	0	0.500	253	25.3	276	27.6	0	1	1	1	1		George Di Martino
LBI	1997	5	5	0	0.500	264	26.4	261	26.1	0					LBI	Glenn Gardner
Garfield	1997	5	5	0	0.500	256	25.6	230	23	0						Marty Yurchak
Ocean City	1997	4	6	0	0.400	195	19.5	284	28.4	0						August Daquila
Urban	1997	4	6	0	0.400	206	20.6	291	29.1	0						John Yurchak
Tampa	1997	3	7	0	0.300	182	18.2	287	28.7	0						Bill Kobus
Ocean City	1996	7	3	0	0.700	283	28.3	246	24.6	0	1	1	1	1		August Daquila
Pomerol	1996	7	3	0	0.700	301	30.1	229	22.9	0	1	1				John Matsikoudis
LBI	1996	6	4	0	0.600	283	28.3	261	26.1	0		1	1		LBI	Glenn Gardner
Kigali	1996	5	5	0	0.500	276	27.6	269	26.9	0		1				Bill Matsikoudis
Newark Bay	1996	5	5	0	0.500	282	28.2	277	27.7	0						Phil Matsikoudis
Vico	1996	4	6	0	0.400	287	28.7	314	31.4	0						George Di Martino
Urban	1996	3	7	0	0.300	247	24.7	302	30.2	0						John Yurchak
Garfield	1996	3	7	0	0.300	251	25.1	310	31	0						Marty Yurchak`;

type TeamRow = { id: number; name: string; teamshort: string | null; coach: string | null; leagueId: number | null };

function findTeam(allTeams: TeamRow[], nameStr: string): TeamRow | undefined {
  const upper = nameStr.trim().toUpperCase();
  return (
    allTeams.find(t => t.teamshort?.toUpperCase() === upper) ||
    allTeams.find(t => t.name.toUpperCase() === upper) ||
    allTeams.find(t => t.name.toUpperCase().startsWith(upper)) ||
    allTeams.find(t => upper.startsWith(t.name.toUpperCase()))
  );
}

async function main() {
  const allTeams: TeamRow[] = await db
    .select({ id: teams.id, name: teams.name, teamshort: teams.teamshort, coach: teams.coach, leagueId: teams.leagueId })
    .from(teams)
    .where(eq(teams.leagueId, LEAGUE_ID));

  const lines = TSV_DATA.split('\n');
  const headers = lines[0].split('\t').map(h => h.trim());

  // Build index of existing standings to avoid duplicates
  const existingStandings = await db
    .select({ teamId: standings.teamId, year: standings.year })
    .from(standings)
    .where(eq(standings.leagueId, LEAGUE_ID));
  const existingSet = new Set(existingStandings.map(r => `${r.teamId}-${r.year}`));

  let inserted = 0;
  let skipped = 0;
  let teamsCreated = 0;
  let coachesUpdated = 0;
  const unmatched: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split('\t');
    const get = (col: string) => (parts[headers.indexOf(col)] ?? '').trim();

    const teamName = get('Team');
    const year = parseInt(get('Year'));
    if (!teamName || isNaN(year)) continue;

    const gm = get('GM/Manager') || null;

    let team = findTeam(allTeams, teamName);

    if (!team) {
      // Create new historical team
      const [newTeam] = await db.insert(teams).values({
        leagueId: LEAGUE_ID,
        name: teamName,
        coach: gm || null,
        touch_id: 'history-import',
      }).returning({ id: teams.id, name: teams.name, teamshort: teams.teamshort, coach: teams.coach, leagueId: teams.leagueId });
      team = newTeam;
      allTeams.push(team);
      teamsCreated++;
      console.log(`  Created team: "${teamName}" (id=${team.id})`);
    } else if (gm && !team.coach) {
      // Populate coach if currently empty
      await db.update(teams).set({ coach: gm, touch_id: 'history-import' }).where(eq(teams.id, team.id));
      team.coach = gm;
      coachesUpdated++;
      console.log(`  Updated coach for "${team.name}": ${gm}`);
    }

    const key = `${team.id}-${year}`;
    if (existingSet.has(key)) {
      skipped++;
      continue;
    }
    existingSet.add(key);

    await db.insert(standings).values({
      leagueId: LEAGUE_ID,
      teamId: team.id,
      year,
      wins: parseInt(get('Won')) || 0,
      losses: parseInt(get('Lost')) || 0,
      ties: parseInt(get('Tie')) || 0,
      offPts: parseInt(get('Offense Points')) || null,
      defPts: parseInt(get('Defense Points')) || null,
      isDivWinner: get('Divsion Win') === '1',
      isPlayoff: get('Playoffs') === '1',
      isSuperBowl: get('Super Bowl') === '1',
      isChampion: get('Super Bowl Win') === '1',
      oldTeamName: get('Old Team Name') || null,
      division: get('Division') || null,
      touch_id: 'history-import',
    });
    inserted++;
  }

  console.log('\n=== Import Complete ===');
  console.log(`Rows inserted:      ${inserted}`);
  console.log(`Rows skipped:       ${skipped} (already existed)`);
  console.log(`Teams created:      ${teamsCreated}`);
  console.log(`Coaches populated:  ${coachesUpdated}`);
  if (unmatched.length) console.log(`Unmatched teams:    ${unmatched.join(', ')}`);
}

main().catch(console.error);
