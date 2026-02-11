# Weekly Overtime

> Applies weekly OT multiplier to cumulative hours exceeding threshold (MINOR BUG: time_out_ts_c vs time_in_ts_c in split case)

## Script Text

```
# # Weekly overtime
#  Applies Weekly Overtime rules to the Time Card Lines of one Time Card, modifying and creating records as necessary.
#  As a Modular script, several assumtions have been made.
#  As a PSOS script, we want to avoid opening windows, and ALL user interactions..
# 
# @history
#  04/14/2014 - Marc Berning - Initial Version
#  06/14/2017 - Marc Berning - Adapted for BiggerHammer
#  01/18/2018 - Marc Berning - Limited Daily ST accumulations to 8 hours / day
#  05/01/2018 - Marc Berning - Minimum Call may be eligable for OT
#  @history Jun 12, 2024, chris.corsi@proofgeist.com & Heather Williams - TCLs with a midnight split (on the next day) were not being evaluated correctly. Added $this_isAfterMidnight to correct
# 
# @assumptions
#  Context: We are already oriented to a Globals-based layout.
#  Environment: Allow User Abort & Error Capture states are appropriately set.
#  Precedence: Daily OT was calculated BEFORE Weekly OT, therefore Daily OT is assumed to be correct.
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# 
# @rule	If any employee works more than {hrs_overtime_weekly} in the work week,
# @rule		they will be paid at {mult_overtime_weekly} times the standard rate.
# @rule	The work week begins on {start_of_week}.
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
Set Variable [ $daily_history_total ; Value: 0 ]
# 
#  Prepare a set of variables based on Contract values.  While not necessary, this will make reading/writing the script easier.
Set Variable [ $hrs_overtime_daily_L1 ; Value: If ( IsEmpty ( GLO_TCD_CTR__Contract::hrs_overtime_daily_L1 ); 	8; 	GLO_TCD_CTR__Contract::hrs_overtime_daily_L1 ) ]
Set Variable [ $hrs_overtime_weekly ; Value: GLO_TCD_CTR__Contract::hrs_overtime_weekly ]
Set Variable [ $seventh_day_stretch ; Value: not IsEmpty ( GLO_TCD_CTR__Contract::hrs_7th_day ) 	and not IsEmpty ( GLO_TCD_CTR__Contract::mult_7th_day ) /* If the current contract implements 7th day rules, we can skip time cards that fall on the 7th day. There is a seperate sript for that specific… ]
Set Variable [ $minimums_included_in_NT ; Value: GetAsBoolean ( GLO_TCD_CTR__Contract::minimums_included_in_NT) ]
Set Variable [ $minimums_included_in_OT ; Value: GetAsBoolean ( GLO_TCD_CTR__Contract::minimums_included_in_OT ) ]
# 
#  Break a few "field" values out into dedicated varaibles.  This will make reading/writing this script easier.
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$i]" ) ]
Set Variable [ $this_date ; Value: GetAsDate ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::date ))) ]
Set Variable [ $this_time_in_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ))) ]
# 
# 
#  Calculate an appropriate start date for the work week based on the Timecard's contract
Set Variable [ $start_date ; Value: Let ([ 	~weekday = GLO_TCD_CTR__Contract::start_of_week; 	~dow = DayOfWeek ( $this_date ); 	~sow = Case ( 		~weekday	= "Event";		DayOfWeek ( GLO_TCD_EVE__Event::Date_Start ); 		~weekday	= "Sunday";		1; 		~weekday	= "Monday";		2; 		~weekday	= "Tuesday";		… ]
# 
#  If this_date is within 5 dayys of $start_date, there is no need to proceed.
Exit Loop If [ $start_date + 5 > $this_date ]
# 
#  Assemble a list of Time Card Line IDs for same day, differnt Time Card(s), without Unpaid Meals
Perform Script [ “Create History Variables” ; Specified: From list ; Parameter: Let ( 	~match = List ( 		GFN ( TCL__TimeCardLine::ignoreOvertime ); 		GFN ( TCL__TimeCardLine::isMinimumCall ); 		GFN ( TCL__TimeCardLine::isPaidMeal ); 		GFN ( TCL__TimeCardLine::isOTDailyL1 ); 		GFN ( TCL__TimeCardLine::isOTDailyL2 ); 		GFN ( TCL__TimeCardLine::time_in_ts_c ); 		GFN ( TCL__TimeCardLine::time_out_ts_c ); 	); 	List ( 		"start_date="			& $start_date; 		"end_ts="				& $$end_ts; 		"match_fields="			& CF_addPSlashes ( ~match ); 		"sort="					& "ASC"; 		"include_Minimum_Calls="	& False; 		"ids_only="				& True; 	) ) ]
// Perform Script [ “Create History Variables” ; Specified: From list ; Parameter: Let ( 	~match = List ( 		GFN ( TCL__TimeCardLine::ignoreOvertime ); 		GFN ( TCL__TimeCardLine::isMinimumCall ); 		GFN ( TCL__TimeCardLine::isPaidMeal ); 		GFN ( TCL__TimeCardLine::isOTDailyL1 ); 		GFN ( TCL__TimeCardLine::isOTDailyL2 ); 		GFN ( TCL__TimeCardLine::time_in_ts_c ); 		GFN ( TCL__TimeCardLine::time_out_ts_c ); 	); 	List ( 		"start_date="			& $start_date; 		"end_ts="				& $$end_ts; 		"match_fields="			& CF_addPSlashes ( ~match ); 		"sort="					& "ASC"; 		"include_Minimum_Calls="	& True; 		"ids_only="				& True; 	) ) ]
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
#  Break a few more "field" values out into dedicated varaibles.  This will make reading/writing this script easier.
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$tcl_loop]" ) ]
Set Variable [ $this_date ; Value: GetAsDate ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::date ))) ]
Set Variable [ $this_time_in ; Value: GetAsTime ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in ))) ]
Set Variable [ $this_time_out ; Value: GetAsTime ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out ))) ]
Set Variable [ $this_time_in_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ))) ]
Set Variable [ $this_time_out_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ))) ]
Set Variable [ $this_ignoreOvertime ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::ignoreOvertime ))) ]
Set Variable [ $this_isMinimumCall ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isMinimumCall ))) ]
Set Variable [ $this_isOTDailyL1 ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ))) ]
Set Variable [ $this_isOTDailyL2 ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ))) ]
Set Variable [ $this_isAfterMidnight ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isAfterMidnight ))) ]
# 
#  Kl 6/28/22 All Unworked Time should respect the same setting for Minimum Calls included or not; https://curtaintime.teamwork.com/desk/tickets/8368516
Set Variable [ $this_isUnworked ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::hrsUnworked ))) ]
# 
Set Variable [ $this_duration ; Value: ( $this_time_out_ts_c - $this_time_in_ts_c ) / 3600 ]
Set Variable [ $history_total ; Value: 0 ]
// Set Variable [ $this_history_date ; Value: "" ]
Set Variable [ $last_history_date ; Value: "" ]
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
#  Keep track if which day in history we are on, so that we can limit our daily additions to 8 hours, even if the rules haven't been run yet.
// Set Variable [ $history_date ; Value: GLO_TCL__TimeCardLine::date ]
If [ GLO_TCL__TimeCardLine::date ≠ $last_history_date ]
Set Variable [ $daily_history_total ; Value: 0 ]
End If
# 
#  If the next history record is later than the current TCL...
If [ GLO_TCL__TimeCardLine::time_in_ts_c > $this_time_in_ts_c ]
#  We're done analyzing history.
Exit Loop If [ True ]
Else
# 
#  If there is column data, we need to use it instead of the in/out clock data, since the values MAY have been altered by the user.  A.K.A. override.
#  KL 9/6/22
If [ 0 ]
// End If
// If [ Sum ( 	GLO_TCL__TimeCardLine::hrsColumn0; 	GLO_TCL__TimeCardLine::hrsColumn1; 	GLO_TCL__TimeCardLine::hrsColumn2; 	GLO_TCL__TimeCardLine::hrsColumn3; 	GLO_TCL__TimeCardLine::hrsColumn4; 	GLO_TCL__TimeCardLine::hrsColumn5 ) > 0 ]
If [ Sum ( GLO_TCL__TimeCardLine::hrsColumn0; GLO_TCL__TimeCardLine::hrsColumn3 ) > 0 ]
Set Variable [ $history_total ; Value: $history_total + Sum ( GLO_TCL__TimeCardLine::hrsColumn0; GLO_TCL__TimeCardLine::hrsColumn3 ) ]
Set Variable [ $daily_history_total ; Value: Min ( 	$hrs_overtime_daily_L1; 	$daily_history_total + Sum ( GLO_TCL__TimeCardLine::hrsColumn0; GLO_TCL__TimeCardLine::hrsColumn3 ) ) ]
End If
Else
# 
#  If the History record is an umpaid meal...
If [ GLO_TCL__TimeCardLine::isUnpaidMeal ]
#  Move along. Nothing to see here.
# 
#  If the History record is a Minimum Call record...
// Else If [ GLO_TCL__TimeCardLine::isMinimumCall and $minimums_included_in_OT ]
#  Kl 6/28/22 All Unworked Time should respect the same setting for Minimum Calls included or not; https://curtaintime.teamwork.com/desk/tickets/8368516
Else If [ ( GLO_TCL__TimeCardLine::isMinimumCall 	or GLO_TCL__TimeCardLine::hrsUnworked > 0 ) 	and $minimums_included_in_OT ]
If [ GLO_TCL__TimeCardLine::ignoreOvertime = True 	or ( 	GLO_TCL__TimeCardLine::isOTDailyL1 ≠ True 		and 	GLO_TCL__TimeCardLine::isOTDailyL2 ≠ True 		and 	GLO_TCL__TimeCardLine::isOTWeekly ≠ True ) ]
Set Variable [ $history_total ; Value: $history_total + ( GLO_TCL__TimeCardLine::timeDuration_c / 3600 ) ]
Set Variable [ $daily_history_total ; Value: Min ( 	$hrs_overtime_daily_L1; 	$daily_history_total + ( GLO_TCL__TimeCardLine::timeDuration_c / 3600 ) ) ]
End If
# 
#  KL 9/6/22
Else If [ ( GLO_TCL__TimeCardLine::isMinimumCall 	or GLO_TCL__TimeCardLine::hrsUnworked > 0 ) 	and not $minimums_included_in_OT ]
# 
#  If the entire duration of the History record falls before the current IN ts...
Else If [ GLO_TCL__TimeCardLine::time_out_ts_c ≤ $this_time_in_ts_c ]
# 
#  If the History record is a paid meal...
If [ GLO_TCL__TimeCardLine::isPaidMeal ]
# @history May 30, 2024, chris.corsi@proofgeist.com - meals should not contribute to weekly overtime if they are daily overtime
Set Variable [ $history_total ; Value: $history_total + Case ( not ( GLO_TCL__TimeCardLine::isOTDailyL1 or GLO_TCL__TimeCardLine::isOTDailyL2 ) ;( GLO_TCL__TimeCardLine::timeDuration_c / 3600 ) ; 0 ) ]
# 
Set Variable [ $daily_history_total ; Value: Min ( 	$hrs_overtime_daily_L1; 	$daily_history_total + ( GLO_TCL__TimeCardLine::timeDuration_c / 3600 ) ) ]
# 
#  If the History record is NOT OT...
Else If [ GLO_TCL__TimeCardLine::ignoreOvertime 	or ( 	GLO_TCL__TimeCardLine::isOTDailyL1 ≠ True 		and 	GLO_TCL__TimeCardLine::isOTDailyL2 ≠ True ) ]
Set Variable [ $history_total ; Value: Let ( 	~hrs = Min ( $hrs_overtime_daily_L1 - $daily_history_total; GLO_TCL__TimeCardLine::timeDuration_c / 3600 ); 	$history_total + ~hrs ) ]
End If
Else
#  Not worth continuing.
Set Variable [ $i ; Value: $history_count ]
End If
End If
# 
#  Add this day to a list of days.  We will eliminate duplicates later.
Set Variable [ $worked_days ; Value: List ( $worked_days; GLO_TCL__TimeCardLine::date ) ]
#  Update the $last_date
Set Variable [ $last_history_date ; Value: GLO_TCL__TimeCardLine::date ]
# 
End If
#  End of History loop
End Loop
# 
#  Add the current Timecard's date to the list, then remove the duplicates.
Set Variable [ $worked_days ; Value: CF_Trim4 ( UniqueValues ( List ( $worked_days; GLO_TCD__TimeCard::date ))) ]
Set Variable [ $is7thDay ; Value: ValueCount ( $worked_days ) = 7 ]
Exit Loop If [ $is7thDay and $seventh_day_stretch ]
# 
# 
# 
#  If we are to ignore Overtime...
If [ $this_ignoreOvertime ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTWeekly ); False ) ]
Set Variable [ $daily_total ; Value: $daily_total + $this_duration ]
# 
# 
# 
#  If this is an unpaid meal...
Else If [ $this_isUnpaidMeal ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTWeekly ); False ) ]
# 
# 
# 
#  If this is a Minimum Call, and they should NOT be included in OT...
// Else If [ $this_isMinimumCall 	and not $minimums_included_in_OT ]
#  Kl 6/28/22 All Unworked Time should respect the same setting for Minimum Calls included or not; https://curtaintime.teamwork.com/desk/tickets/8368516
Else If [ ( $this_isMinimumCall 	or $this_isUnworked ) 	and not $minimums_included_in_OT ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTWeekly ); False ) ]
# 
# 
# 
#  If we have ALREADY surpassed either of the Daily limits - nothing for us to do.
Else If [ $this_isOTDailyL1 	or $this_isOTDailyL2 ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTWeekly ); False ) ]
# 
# 
# 
#  If we will NOT surpass the Weekly limit - this is NOT Weekly OT.
Else If [ $daily_total + $history_total + $this_duration ≤ $hrs_overtime_weekly ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTWeekly ); False ) ]
Set Variable [ $daily_total ; Value: $daily_total + $this_duration ]
# 
# 
# 
#  If we have already met or surpassed the Weekly limit - everything is Weekly OT
Else If [ $daily_total + $history_total ≥ $hrs_overtime_weekly ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTWeekly ); True ) ]
# 
# 
# 
#  Else, we have splitting to do.
Else
# 
# 
# 
#  If we WILL surpass the Weekly limit...
If [ $daily_total + $history_total < $hrs_overtime_weekly 	and $daily_total + $history_total + $this_duration > $hrs_overtime_weekly ]
# 
#  Calculate the time of the Weekly equivelant.
Set Variable [ $weekly_out_time ; Value: $this_time_in + (( $hrs_overtime_weekly - $daily_total - $history_total ) * 3600 ) ]
# 
#  Duplicate the current "record".
Perform Script [ “Duplicate Rule Variable” ; Specified: From list ; Parameter: "source=" & $tcl_loop ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Set Variable [ $record_count ; Value: $record_count + 1 ]
Exit Loop If [ $error ]
# 
#  Change the current record's out time to the weekly equivalent.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out ); $weekly_out_time ) ]
// Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $this_date; $weekly_out_time )) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $this_date +  $this_isAfterMidnight ; $weekly_out_time )) ]
# 
#  Make sure the first record is NOT OT
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTWeekly ); False ) ]
# 
#  Clear the Grace Period note form the "first" record.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::noteGracePeriod ); "" ) ]
# 
#  Commit the changes back to the master global variable.
Set Variable [ $null ; Value: CF_SetVarByName ( "$$" & $$this_mode; $tcl_loop; $this_record ) ]
Set Variable [ $daily_total ; Value: $daily_total + $this_duration ]
# 
#  Move to the "new record"
Set Variable [ $tcl_loop ; Value: $tcl_loop + 1 ]
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$tcl_loop]" ) ]
# 
#  Set the new record to start at the weekly equivalent.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in ); $weekly_out_time ) ]
// Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( $this_date; $weekly_out_time )) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $this_date +  $this_isAfterMidnight ; $weekly_out_time )) ]
# 
#  Set the new record to be Weekly OT
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTWeekly ); True ) ]
# 
# 
# 
#  Unrecognized Situation
Else
Set Variable [ $error ; Value: True ]
Set Variable [ $message ; Value: "This Daily Overtime situation had not occurred to the developer." ]
Exit Loop If [ True ]
End If
End If
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
