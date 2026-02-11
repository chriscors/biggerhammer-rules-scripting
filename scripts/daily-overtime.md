# Daily Overtime

> Splits hours exceeding daily OT thresholds and applies multipliers

## Script Text

```
# Daily overtime
#  Applies Daily Overtime rules to the Time Card Lines of one Time Card, modifying and creating records as necessary.
#  As a Modular script, several assumtions have been made.
#  As a PSOS script, we want to avoid opening windows, and ALL user interactions..
# 
# @history
#  04/14/2014 - Marc Berning - Initial Version
#  06/14/2017 - Marc Berning - Adapted for BiggerHammer
#  05/01/2018 - Marc Berning - Minimum Call may be eligable for OT
#  05/23/2022 - Kate Lee - https://curtaintime.teamwork.com/desk/tickets/8239519  All Non-Minimum Unworked Time is not counted towards or paid at Daily OT ➜🌎 
# @history Jun 12, 2024, chris.corsi@proofgeist.com & Heather Williams - TCLs with a midnight split (on the next day) were not being evaluated correctly. Added $this_isAfterMidnight to correct
# 
# @assumptions
#  Context: We are already oriented to a Globals-based layout.
#  Environment: Allow User Abort & Error Capture states are appropriately set.
#  Precedence: Daily OT is being calculated BEFORE Weekly OT, therefore every line is being set as NOT Weekly OT.
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# 
# @rule	If any employee works more than {hrs_overtime_daily_L1},
# @rule		they will be paid at {mult_overtime_daily_L1} times the standard rate.
# @rule	If they work more than {hrs_overtime_daily_L2},
# @rule		they will be paid at {mult_overtime_daily_L2} times the standard rate.
# @rule	Minimum Call records are always paid @ ST.
# 
# @todo	Script does not yet accomodate proper Billable processing when a Timecard includes multiple events.
# 
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Preheat variables here
Set Variable [ $record_count ; Value: Evaluate ( "$$" & $$this_mode & "_count" ) ]
Set Variable [ $daily_total ; Value: 0 ]
# 
#  From the contract, store values for when Level 1 & Level 2 Overtime starts.
Set Variable [ $hrs_overtime_daily_L1 ; Value: GLO_TCD_CTR__Contract::hrs_overtime_daily_L1 ]
Set Variable [ $hrs_overtime_daily_L2 ; Value: If ( IsEmpty ( GLO_TCD_CTR__Contract::hrs_overtime_daily_L2 ); 	99; 	GLO_TCD_CTR__Contract::hrs_overtime_daily_L2 ) ]
Set Variable [ $minimums_included_in_OT ; Value: GetAsBoolean ( GLO_TCD_CTR__Contract::minimums_included_in_OT ) ]
# 
#  Assemble a list of Time Card Line IDs for same day, differnt Time Card(s), without Unpaid Meals
Perform Script [ “Create History Variables” ; Specified: From list ; Parameter: Let ( 	~match = List ( 		GFN ( TCL__TimeCardLine::ignoreOvertime ); 		GFN ( TCL__TimeCardLine::isMinimumCall ); 		GFN ( TCL__TimeCardLine::isPaidMeal ); 		GFN ( TCL__TimeCardLine::isOTDailyL1 ); 		GFN ( TCL__TimeCardLine::isOTDailyL2 ); 		GFN ( TCL__TimeCardLine::time_in_ts_c ); 		GFN ( TCL__TimeCardLine::time_out_ts_c ); 	); 	List ( 		"start_date="			& GLO_TCD__TimeCard::date; 		"end_ts="				& $$end_ts; 		"match_fields="			& CF_addPSlashes ( ~match ); 		"sort="					& "ASC"; 		"include_Minimum_Calls="	& True; 		"ids_only="				& True; 	) ) ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Set Variable [ $history_count ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "count" )) ]
Set Variable [ $matching_ids ; Value: CF_getProperty ( $scriptResult; "matching_ids" ) ]
If [ $error ]
Set Variable [ $error ; Value: 1 ]
Exit Loop If [ True ]
End If
# 
#  Loop through the Time Card Lines
Set Variable [ $tcl_loop ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $tcl_loop = $tcl_loop + 1; $tcl_loop > $record_count ) ]
# 
#  Break a few "field" values out into dedicated varaibles.  This will make reading/writing this script easier.
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$tcl_loop]" ) ]
Set Variable [ $this_date ; Value: GetAsDate ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::date ))) ]
Set Variable [ $this_time_in ; Value: GetAsTime ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in ))) ]
Set Variable [ $this_time_out ; Value: GetAsTime ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out ))) ]
Set Variable [ $this_time_in_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ))) ]
Set Variable [ $this_time_out_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ))) ]
Set Variable [ $this_ignoreOvertime ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::ignoreOvertime ))) ]
Set Variable [ $this_isMinimumCall ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isMinimumCall ))) ]
Set Variable [ $this_isUnpaidMeal ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isUnpaidMeal ))) ]
Set Variable [ $this_isAfterMidnight ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isAfterMidnight ))) ]
Set Variable [ $this_duration ; Value: ( $this_time_out_ts_c - $this_time_in_ts_c ) / 3600 ]
Set Variable [ $history_total ; Value: 0 ]
# 
# KL 5/23/22
Set Variable [ $this_isUnworked ; Value: GetAsBoolean ( CF_getProperty ( $this_record ; GFN ( TCL__TimeCardLine::hrsUnworked ) ) ) ]
# 
#  Based on the current "record", analyze our History for applicable time.
Set Variable [ $i ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i + 1; $i > $history_count ) ]
# 
#  Form a relationship with the next historical TCL record.
Set Field [ GLO__Global::_new_id_g ; "" ]
Set Field [ GLO__Global::_new_id_g ; GetValue ( $matching_ids; $i ) ]
# 
#  We are done with the history if the next history record is later than the current TCL...
Exit Loop If [ GLO_TCL__TimeCardLine::time_in_ts_c > $this_time_in_ts_c ]
# 
If [ GLO_TCL__TimeCardLine::isUnpaidMeal ]
#  Move along. Nothing to see here.
# 
# KL 5/23/22
Else If [ GetAsBoolean ( GLO_TCL__TimeCardLine::hrsUnworked ) 	and not GLO_TCL__TimeCardLine::isMinimumCall ]
#  Move along. Nothing to see here.
# 
Else If [ GLO_TCL__TimeCardLine::isMinimumCall 	and $minimums_included_in_OT = False ]
#  Move along. Nothing to see here.
# 
#  If there is column data, we need to use it instead of the in/out clock data, since the values MAY have been altered by the user.  A.K.A. override.
Else If [ Sum ( 	GLO_TCL__TimeCardLine::hrsColumn0; 	GLO_TCL__TimeCardLine::hrsColumn1; 	GLO_TCL__TimeCardLine::hrsColumn2; 	GLO_TCL__TimeCardLine::hrsColumn3; 	GLO_TCL__TimeCardLine::hrsColumn4; 	GLO_TCL__TimeCardLine::hrsColumn5 ) > 0 ]
Set Variable [ $history_total ; Value: $history_total + Sum ( GLO_TCL__TimeCardLine::hrsColumn0; GLO_TCL__TimeCardLine::hrsColumn3 ) ]
# 
Else
Set Variable [ $history_total ; Value: $history_total + ( GLO_TCL__TimeCardLine::timeDuration_c / 3600 ) ]
# 
End If
#  End of History loop
End Loop
# 
# 
# 
#  If we are to ignore Overtime...
If [ $this_ignoreOvertime ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); False ) ]
# 
# 
# 
#  If this is an unpaid meal...
Else If [ $this_isUnpaidMeal ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); False ) ]
# 
# 
# KL 5/23/22
Else If [ $this_isUnworked 	and not $this_isMinimumCall ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); False ) ]
# 
# 
#  If this is a minimum, and minimums should NOT be included in OT calculations
Else If [ $this_isMinimumCall 	and not $minimums_included_in_OT ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); False ) ]
# 
# 
# 
#  If we will NOT surpass the L1 limits - Everything is Regular pay
Else If [ $daily_total + $history_total + $this_duration ≤ $hrs_overtime_daily_L1 ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); False ) ]
# 
# 
# 
#  If we HAVE already met the L1 limit, but WILL NOT surpass the L2 Limit - everything is Daily L1 OT
Else If [ $daily_total + $history_total ≥ $hrs_overtime_daily_L1 	and $daily_total + $history_total + $this_duration ≤ $hrs_overtime_daily_L2 ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); True ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); False ) ]
# 
# 
# 
#  If we have ALREADY reached the L2 limit - everything is Daily L2 OT
Else If [ $daily_total + $history_total ≥ $hrs_overtime_daily_L2 ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); True ) ]
# 
# 
# 
#  Else, we have splitting to do.
Else
# 
# 
# 
#  If we WILL surpass the L1 limit but WILL NOT surpass the L2 limit...
If [ $daily_total + $history_total < $hrs_overtime_daily_L1 	and $daily_total + $history_total + $this_duration ≤ $hrs_overtime_daily_L2 ]
# 
#  Calculate the time of the L1 equivelant.
Set Variable [ $L1_out_time ; Value: $this_time_in + (( $hrs_overtime_daily_L1 - $daily_total - $history_total ) * 3600 ) ]
# 
#  Duplicate the current "record".
Perform Script [ “Duplicate Rule Variable” ; Specified: From list ; Parameter: "source=" & $tcl_loop ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Set Variable [ $record_count ; Value: $record_count + 1 ]
Exit Loop If [ $error ]
# 
#  Change the current record's out time to the L1 equivalent.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out ); $L1_out_time ) ]
// Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $this_date; $L1_out_time )) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $this_date + $this_isAfterMidnight ; $L1_out_time )) ]
# 
#  Make sure the first record is NOT OT
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); False ) ]
# 
#  Clear the Grace Period note form the "first" record.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::noteGracePeriod ); "" ) ]
# 
#  Commit the changes back to the master global variable.
Set Variable [ $null ; Value: CF_SetVarByName ( "$$" & $$this_mode; $tcl_loop; $this_record ) ]
# 
#  Move to the "new record"
Set Variable [ $tcl_loop ; Value: $tcl_loop + 1 ]
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$tcl_loop]" ) ]
# 
#  Set the new record to start at the L1 equivalent.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in ); $L1_out_time ) ]
// Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( $this_date; $L1_out_time )) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( $this_date + $this_isAfterMidnight ; $L1_out_time )) ]
# 
#  Set the new record to be L1 OT
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); True ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); False ) ]
# 
# 
# 
#  If we have ALREADY passed the L1 limit, and WILL surpass the L2 limit...
Else If [ $daily_total + $history_total ≥ $hrs_overtime_daily_L1 	and $daily_total + $history_total + $this_duration > $hrs_overtime_daily_L2 ]
# 
#  Calculate the time of the L2 equivelant.
Set Variable [ $L2_out_time ; Value: $this_time_in + (( $hrs_overtime_daily_L2 - $daily_total - $history_total ) * 3600 ) ]
# 
#  Duplicate the current "record".
Perform Script [ “Duplicate Rule Variable” ; Specified: From list ; Parameter: "source=" & $tcl_loop ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Set Variable [ $record_count ; Value: $record_count + 1 ]
Exit Loop If [ $error ]
# 
#  Change the current record's out time to the L2 equivalent.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out ); $L2_out_time ) ]
// Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $this_date; $L2_out_time )) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $this_date +  $this_isAfterMidnight ; $L2_out_time )) ]
# 
#  Make sure the first record is L1 OT
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); True ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); False ) ]
# 
#  Clear the Grace Period note form the "first" record.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::noteGracePeriod ); "" ) ]
# 
#  Commit the changes back to the master global variable.
Set Variable [ $null ; Value: CF_SetVarByName ( "$$" & $$this_mode; $tcl_loop; $this_record ) ]
# 
#  Move to the "new record"
Set Variable [ $tcl_loop ; Value: $tcl_loop + 1 ]
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$tcl_loop]" ) ]
# 
#  Set the new record to start at the L2 equivalent.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in ); $L2_out_time ) ]
// Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( $this_date; $L2_out_time )) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( $this_date +  $this_isAfterMidnight ; $L2_out_time )) ]
# 
#  Set the new record to be L2 OT
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); True ) ]
# 
# 
# 
#  We WILL surpass both L1 and L2 limits...
Else If [ $daily_total + $history_total < $hrs_overtime_daily_L1 	and $daily_total + $history_total + $this_duration > $hrs_overtime_daily_L2 ]
# 
#  Calculate the time of the L1 and L2 equivelants.
Set Variable [ $L1_out_time ; Value: $this_time_in + (( $hrs_overtime_daily_L1 - $daily_total - $history_total ) * 3600 ) ]
Set Variable [ $L2_out_time ; Value: $this_time_in + (( $hrs_overtime_daily_L2 - $daily_total - $history_total ) * 3600 ) ]
# 
#  Duplicate the current "record".
Perform Script [ “Duplicate Rule Variable” ; Specified: From list ; Parameter: "source=" & $tcl_loop ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Set Variable [ $record_count ; Value: $record_count + 1 ]
Exit Loop If [ $error ]
# 
#  Change the current record's out time to the L1 equivalent.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out ); $L1_out_time ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $this_date; $L1_out_time )) ]
# 
#  Make sure the first record is NOT OT
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); False ) ]
# 
#  Clear the Grace Period note form the "first" record.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::noteGracePeriod ); "" ) ]
# 
#  Commit the changes back to the master global variable.
Set Variable [ $null ; Value: CF_SetVarByName ( "$$" & $$this_mode; $tcl_loop; $this_record ) ]
# 
#  Move to the "new record"
Set Variable [ $tcl_loop ; Value: $tcl_loop + 1 ]
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$tcl_loop]" ) ]
# 
#  Set the new record to start at the L1 equivalent.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in ); $L1_out_time ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( $this_date; $L1_out_time )) ]
# 
#  Set the new record to be L1 OT
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); True ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); False ) ]
# 
#  Preserve the changes made to $this_record.
Set Variable [ $null ; Value: Let ( 	~var = "$$" & $$this_mode; 	CF_SetVarByName ( ~var; $tcl_loop; $this_record ) ) ]
# 
#  Duplicate the current "record".
Perform Script [ “Duplicate Rule Variable” ; Specified: From list ; Parameter: "source=" & $tcl_loop ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Set Variable [ $record_count ; Value: $record_count + 1 ]
Exit Loop If [ $error ]
# 
#  Change the current record's out time to the L2 equivalent.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out ); $L2_out_time ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $this_date; $L2_out_time )) ]
# 
#  Clear the Grace Period note form the "first" record.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::noteGracePeriod ); "" ) ]
# 
#  Commit the changes back to the master global variable.
Set Variable [ $null ; Value: CF_SetVarByName ( "$$" & $$this_mode; $tcl_loop; $this_record ) ]
# 
#  Move to the "new record"
Set Variable [ $tcl_loop ; Value: $tcl_loop + 1 ]
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$tcl_loop]" ) ]
# 
#  Set the new record to start at the L2 equivalent.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in ); $L2_out_time ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( $this_date; $L2_out_time )) ]
# 
#  Set the new record to be L2 OT
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); True ) ]
# 
# 
# 
Else
# 
#  Unrecognized Situation
Set Variable [ $error ; Value: True ]
Set Variable [ $message ; Value: "This Daily Overtime situation had not occurred to the developer." ]
Exit Loop If [ True ]
# 
End If
End If
# 
#  Update the Daily OverTime counter
Set Variable [ $daily_total ; Value: If ( $this_isUnpaidMeal; 	$daily_total; 	$daily_total + $this_duration ) ]
# 
#  Preserve the changes made to $this_record.
Set Variable [ $null ; Value: Let ( 	~var = "$$" & $$this_mode; 	CF_SetVarByName ( ~var; $tcl_loop; $this_record ) ) ]
# 
#  End of Time Card Line loop
End Loop
# 
Exit Loop If [ True		//  Always exit the single-iteration control loop to prevent infinite spin!  ]
End Loop
# 
#  Cleanup steps: return to the original layout, gather script results, etc...
Set Variable [ $result ; Value: List	( 	"error="			& If ( IsEmpty ( $error ); 0; $error ); 	"message="		& CF_addPSlashes ( $message ); 	"scriptName="	& Get ( ScriptName ); ) ]
# 
#  That's it - exit script!
Exit Script [ Text Result: $result		//  We always return the result variable  ]
# 

```
