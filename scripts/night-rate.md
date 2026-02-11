# Night Rate

> Applies night differential multiplier to hours within the night window

## Script Text

```
# # Night rate 
#  Applies Night Rate rules to the Time Card Lines of one Time Card, modifying and creating records as necessary.
#  As a Modular script, several assumtions have been made.
#  As a PSOS script, we must avoid opening windows, and ALL user interactions..
# 
# @history
#  12/06/2016 - Marc Berning - Initial Version
#  06/07/2017 - Marc Berning - Temporarily simplified to ignore times outside the current Time Card.
#  07/11/2018 - Marc Berning - Corrected an after-midnight start of NR error where in_ts and out_ts had the wrong date
# 
# @assumptions
#  Context: We are already oriented to a Globals-based layout.
#  Context: The "current" Time Card is & its related Contract is available via the GLO_TCD__Timecard and GLO_TCD_CTR__Contract relationships.
#  Environment: Allow User Abort & Error Capture states are appropriately set.
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# 
# @rule	If any employee works between the hours of {time_night_start} & {time_night_end}
# @rule		they will be paid at {rule_mult_night} times the standard rate.
# @rule	In addition, if they have worked more than {hrs_night_rate_carryover} in this timeframe,
# @rule		they will continue at {rule_mult_night} times the standard rate until
# @rule		they have had a break of {hrs_tunraround_night} hours.
# 
# @todo  A TCL that starts before a Night Rate window, and ends AFTER the Night Rate window, is not yet handled by this script.
# 
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Prepare a set of variables based on Contract values.  While not necessary, this will make reading/writing the script easier.
Set Variable [ $night_start ; Value: GLO_TCD_CTR__Contract::time_night_start ]
Set Variable [ $night_end ; Value: GLO_TCD_CTR__Contract::time_night_end ]
Set Variable [ $minimums_included_in_NT ; Value: GetAsBoolean ( GLO_TCD_CTR__Contract::minimums_included_in_NT ) ]
#  Setting the $carryover_hours to a very high number will limit NR to just the contract windows (midnight to 6 AM)
// Set Variable [ $carryover_hours ; Value: GLO_TCD_CTR__Contract::hrs_night_rate_carryover ]
Set Variable [ $carryover_hours ; Value: 99 ]
# 
# KL 3/11/22 Determined this field is wack | Teamwork Desk Ticket 7952228 | Night rate should end at [6AM]
// Set Variable [ $turnaround_hours ; Value: GLO_TCD_CTR__Contract::hrs_turnaround_night ]
Set Variable [ $turnaround_hours ; Value: 0 ]
# 
Set Variable [ $precursor_NR_hours ; Value: 0 ]
# 
#  Having finished analyzing the history records, we are ready to apply Night Rate to the current Time Card Lines
Set Variable [ $night_rate_hours ; Value: $precursor_NR_hours ]
Set Variable [ $is_night_rate ; Value: False ]
Set Variable [ $record_count ; Value: Evaluate ( "$$" & $$this_mode & "_count" ) ]
# 
#  Loop through the Bill/Pay repeating variables
Set Variable [ $i ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i + 1; $i > $record_count ) ]
# 
#  Break a few "field" values out into dedicated varaibles.  This will make reading/writing this section much easier, and reduce custom function calls.
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$i]" ) ]
Set Variable [ $this_date ; Value: GetAsDate ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::date ))) ]
Set Variable [ $this_time_in ; Value: GetAsTime ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in ))) ]
Set Variable [ $this_time_out ; Value: GetAsTime ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out ))) ]
Set Variable [ $this_time_in_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ))) ]
Set Variable [ $this_time_out_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ))) ]
Set Variable [ $this_ignoreNightRate ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::ignoreNightRate ))) ]
Set Variable [ $this_isAfterMidnight ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isAfterMidnight ))) ]
Set Variable [ $this_isMinimumCall ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isMinimumCall ))) ]
Set Variable [ $this_isPaidMeal ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isPaidMeal ))) ]
Set Variable [ $this_isUnpaidMeal ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isUnpaidMeal ))) ]
# 
#  Because every Call has 2 night rate periods (the early morning, and the after-midnight) we need to create TimeStamp versions of each.
Set Variable [ $early_night_start_ts ; Value: Timestamp ( $this_date; $night_start ) ]
Set Variable [ $early_night_end_ts ; Value: Timestamp ( $this_date; $night_end ) ]
Set Variable [ $late_night_start_ts ; Value: Timestamp ( $this_date + 1; $night_start ) ]
Set Variable [ $late_night_end_ts ; Value: Timestamp ( $this_date + 1; $night_end ) ]
# 
# 
#  Start to examine each Time Card Line (variable) for their night-rate qualifications.
# 
# 
#  Compare the current IN_TS against the last OUT_TS - if possible - to account for TCL gaps.
If [ $last_out_ts 	and $this_time_in_ts_c ≥ $last_out_ts + Time ( $turnaround_hours; 0; 0 ) ]
Set Variable [ $night_rate_hours ; Value: 0 ]
Set Variable [ $is_night_rate ; Value: False ]
End If
# 
# 
#  If we have been directed to ignore Night Rate...
If [ $this_ignoreNightRate ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); False ) ]
# 
#  Reset the counters.
Set Variable [ $night_rate_hours ; Value: 0 ]
Set Variable [ $is_night_rate ; Value: False ]
# 
# 
#  If the current TCL is an unpaid meal...
Else If [ $this_isUnpaidMeal ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); False ) ]
# 
#  If the current TCL is longer than the contract turnaround time...
If [ ( $this_time_out_ts_c - $this_time_in_ts_c ) ≥ Time ( $turnaround_hours; 0; 0 ) ]
Set Variable [ $night_rate_hours ; Value: 0 ]
Set Variable [ $is_night_rate ; Value: False ]
End If
# 
# 
#  If the current TCL is a Minimum Call, but we are to EXCLUDE minimum call from Night Rate...
Else If [ $this_isMinimumCall 	and not $minimums_included_in_NT ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); False ) ]
# 
# 
#  If the current TCL is a Minimum Call, and starts at Midnight...
Else If [ $this_isMinimumCall 	and GetAsTime ( $this_time_in_ts_c ) = 0 ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); False ) ]
# 
# 
#  The entire line falls within the early Night Rate window...
#     or
#  The entire line falls within the late Night Rate window...
Else If [ ( 	$this_time_in_ts_c ≥ $early_night_start_ts 		and 	$this_time_out_ts_c ≤ $early_night_end_ts ) 	or ( 	$this_time_in_ts_c ≥ $late_night_start_ts 		and 	$this_time_out_ts_c ≤ $late_night_end_ts ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); True ) ]
Set Variable [ $night_rate_hours ; Value: $night_rate_hours + ( $this_time_out_ts_c - $this_time_in_ts_c ) ]
Set Variable [ $is_night_rate ; Value: $night_rate_hours > $carryover_hours ]
# 
# 
#  If we have already met the Night Rate Carryover minimum...
# KL 10/18/21 Disabled this chunk as $night_rate_hours was 2:00:00 and @carryover_hours was 99
// Else If [ $night_rate_hours > $carryover_hours ]
// Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); True ) ]
// Set Variable [ $night_rate_hours ; Value: $night_rate_hours + ( $this_time_out_ts_c - $this_time_in_ts_c ) ]
// Set Variable [ $is_night_rate ; Value: True ]
# 
# 
#  If the entire line is outside any Night Rate window...
Else If [ ( 	$this_time_in_ts_c ≤ $early_night_start_ts 		and 	$this_time_out_ts_c ≤ $early_night_start_ts ) 	or ( 	$this_time_in_ts_c ≥ $late_night_end_ts 		and 	$this_time_out_ts_c ≥ $late_night_end_ts ) 	or ( 	$this_time_in_ts_c ≥ $early_night_end_ts 		and 	$this_time_out_ts_c ≤ $late_night_start_ts ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); False ) ]
# 
# 
#  If the line starts in the early Night Rate window, and ends after its conclusion,
#      or
#  If the line starts in the late Night Rate window, and ends after its conclusion...
#      and
#  the acculumated $night_rate_hours plus this line's share of night rate is sufficient to put us over the Carryover minimum...
Else If [ ( 	$this_time_in_ts_c < $early_night_end_ts 		and 	$this_time_out_ts_c > $early_night_end_ts 		and 	$night_rate_hours + (( $early_night_end_ts - $this_time_in_ts_c ) / 3600 ) > $carryover_hours ) 		or ( 	$this_time_in_ts_c < $late_night_end_ts 		and 	$this_time_out_ts_c > $late_night_end_ts 		and 	$night_rate_hours + (( $late_night_end_ts - $this_time_in_ts_c ) / 3600 ) > $carryover_hours ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); True ) ]
Set Variable [ $night_rate_hours ; Value: $night_rate_hours + ( $this_time_out_ts_c - $this_time_in_ts_c ) ]
Set Variable [ $is_night_rate ; Value: True ]
# 
# 
# 
#  Otherwise we have Line splitting to do.
# 
# 
# 
#  If the line starts before the early Night Rate window, and ends within the early window...
#      or
#  If the line starts before the late Night Rate window, and ends within the late window...
Else If [ ( 	$this_time_in_ts_c < $early_night_start_ts 		and 	$this_time_out_ts_c > $early_night_start_ts 		and 	$this_time_out_ts_c ≤ $early_night_end_ts ) 	or ( 	$this_time_in_ts_c < $late_night_start_ts 		and 	$this_time_out_ts_c > $late_night_start_ts 		and 	$this_time_out_ts_c ≤ $late_night_end_ts ) ]
# 
#  Duplicate the current "record".
Perform Script [ “Duplicate Rule Variable” ; Specified: From list ; Parameter: "source=" & $i ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Set Variable [ $record_count ; Value: $record_count + 1 ]
Exit Loop If [ $error ]
# 
#  Modify the current record to end at the appropriate time.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out ); $night_start ) ]
Set Variable [ $this_record ; Value: Let ( 	~date = $this_date + $this_isAfterMidnight; 	CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( ~date; $night_start )) ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::noteGracePeriod ); "" ) ]
# 
#  Refresh the global variable with the current values contained in $this_record.
Set Variable [ $null ; Value: CF_SetVarByName ("$$" & $$this_mode; $i; $this_record ) ]
# 
#  Move to the "new record"
Set Variable [ $i ; Value: $i + 1 ]
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$i]" ) ]
# 
#  Correct the time_in and the time_in_ts
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in ); $night_start ) ]
Set Variable [ $this_record ; Value: Let ( 	~date = $this_date + $this_isAfterMidnight; 	CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( ~date; $night_start )) ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); True ) ]
Set Variable [ $night_rate_hours ; Value: Let ([ 	~in  = GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in ))); 	~out = GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out ))) ]; 	$night_rate_hours + ( ~out - ~in ) ) ]
# 
# 
#  If the line starts within the early Night Rate window, and ends after the early window ends...
#      or
#  If the line starts within the late Night Rate window, and ends after the late window ends...
Else If [ ( 	$this_time_in_ts_c ≥ $early_night_start_ts 		and 	$this_time_in_ts_c < $early_night_end_ts 		and 	$this_time_out_ts_c > $early_night_end_ts ) 	or ( 	$this_time_in_ts_c ≥ $late_night_start_ts 		and 	$this_time_in_ts_c < $late_night_end_ts 		and 	$this_time_out_ts_c > $late_night_end_ts ) ]
# 
#  Duplicate the current "record".
Perform Script [ “Duplicate Rule Variable” ; Specified: From list ; Parameter: "source=" & $i ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Set Variable [ $record_count ; Value: $record_count + 1 ]
Exit Loop If [ $error ]
# 
#  Modify the current record to end at the appropriate time.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out ); $night_end ) ]
Set Variable [ $this_record ; Value: Let ( 	~date = $this_date + $this_isAfterMidnight; 	CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( ~date; $night_end )) ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); True ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::noteGracePeriod ); "" ) ]
Set Variable [ $night_rate_hours ; Value: Let ([ 	~in  = GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in ))); 	~out = GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out ))) ]; 	$night_rate_hours + ( ~out - ~in ) ) ]
# 
#  Refresh the global variable with the current values contained in $this_record.
Set Variable [ $null ; Value: CF_SetVarByName ("$$" & $$this_mode; $i; $this_record ) ]
# 
#  Move to the "new record"
Set Variable [ $i ; Value: $i + 1 ]
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$i]" ) ]
# 
#  Correct the time_in and the time_in_ts
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in ); $night_end ) ]
Set Variable [ $this_record ; Value: Let ( 	~date = $this_date + $this_isAfterMidnight; 	CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( ~date; $night_end )) ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); False ) ]
# 
# 
#  If the line starts before the early Night Rate window, and ends after the early window ends...
#      or
#  If the line starts before the late Night Rate window, and ends after the late window ends...
Else If [ ( 	$this_time_in_ts_c < $early_night_start_ts 		and 	$this_time_out_ts_c > $early_night_end_ts ) 	or ( 	$this_time_in_ts_c < $late_night_start_ts 		and 	$this_time_out_ts_c > $late_night_end_ts ) ]
# 
#  Duplicate the current "record".
Perform Script [ “Duplicate Rule Variable” ; Specified: From list ; Parameter: "source=" & $i ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Set Variable [ $record_count ; Value: $record_count + 1 ]
Exit Loop If [ $error ]
# 
#  Duplicate the current "record".
Perform Script [ “Duplicate Rule Variable” ; Specified: From list ; Parameter: "source=" & $i ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Set Variable [ $record_count ; Value: $record_count + 1 ]
Exit Loop If [ $error ]
# 
#  Modify the current record to end at the appropriate time.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out ); $night_start ) ]
Set Variable [ $this_record ; Value: Let ( 	~date = $this_date + $this_isAfterMidnight; 	CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( ~date; $night_start )) ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::noteGracePeriod ); "" ) ]
// Set Variable [ $night_rate_hours ; Value: Let ([ 	~in  = GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in ))); 	~out = GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out ))) ]; 	$night_rate_hours + ( ~out - ~in ) ) ]
# 
#  Refresh the global variable with the current values contained in $this_record.
Set Variable [ $null ; Value: CF_SetVarByName ("$$" & $$this_mode; $i; $this_record ) ]
# 
#  Move to the "new record"
Set Variable [ $i ; Value: $i + 1 ]
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$i]" ) ]
# 
#  Modify the current record to start and end at the appropriate times.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in ); $night_start ) ]
Set Variable [ $this_record ; Value: Let ( 	~date = $this_date + 1; 	CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( ~date; $night_start )) ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out ); $night_end ) ]
Set Variable [ $this_record ; Value: Let ( 	~date = $this_date + 1; 	CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( ~date; $night_end )) ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); True ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::noteGracePeriod ); "" ) ]
Set Variable [ $night_rate_hours ; Value: Let ([ 	~in  = GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in ))); 	~out = GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out ))) ]; 	$night_rate_hours + ( ~out - ~in ) ) ]
# 
#  Refresh the global variable with the current values contained in $this_record.
Set Variable [ $null ; Value: CF_SetVarByName ("$$" & $$this_mode; $i; $this_record ) ]
# 
#  Move to the "new record"
Set Variable [ $i ; Value: $i + 1 ]
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$i]" ) ]
# 
#  Correct the time_out and the time_out_ts
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in ); $night_end ) ]
Set Variable [ $this_record ; Value: Let ( 	~date = $this_date + 1; 	CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( ~date; $night_end )) ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); False ) ]
# 
End If
# 
#  Remember the last OUT time, so that it can be compared with the next IN time, watching for $turnaround_hours (unless it was an unpaid meal)
If [ not GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isUnpaidMeal ))) ]
Set Variable [ $last_out_ts ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ))) ]
End If
# 
#  Preserve the changes made to $this_record.
Set Variable [ $null ; Value: Let ( 	~var = "$$" & $$this_mode; 	CF_SetVarByName ( ~var; $i; $this_record ) ) ]
# 
#  End of record loop
End Loop
# 
Exit Loop If [ True		//  Always exit the single-iteration control loop to prevent infinite spin!  ]
End Loop
# 
#  Cleanup steps: close worker windows, gather script results, etc...
Set Variable [ $result ; Value: List	( 	"error="			& If ( IsEmpty ( $error ); 0; $error ); 	"message="		& CF_addPSlashes ( $message ); 	"scriptName="	& Get ( ScriptName ); ) ]
# 
#  That's it - exit script!
Exit Script [ Text Result: $result		//  We always return the result variable  ]
# 

```
