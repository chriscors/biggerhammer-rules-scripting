# Meal Penalty - Multiplicative

> Multiplicative meal penalty — flags and splits existing TCL entries (SECONDARY BUG: stale $record_count)

## Script Text

```
# # Meal penalty multiplicative 
#  Applies Meal Penalty rules to the Time Card Lines
#  As a modular script, several assumptions will be made regarding the context & environment.
#  As a PSOS script, we want to avoid opening windows, and ALL user interactions..
# 
# @history
#  07/28/2015 - Deborah Norton - Initial version
#  06/18/2015 - Marc Berning - Rewrite for transactionality using GLOBAL table.
#  11/03/2015 - Marc Berning - Converted to modular script.
#  12/27/2016 - Marc Berning - Adapted to Bigger Hammer
# 
# @assumptions
#  Context: We are already oriented to a Globals-based layout.
#  Context: The "current" Time Card is & its related Contract is available via the GLO_TCD__Timecard and GLO_TCD_CTR__Contract relationships.
#  Environment: Allow User Abort & Error Capture states are appropriately set.
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# 
# @rule	If an employee works more than {hrs_before_meal_penalty1} (5 hours) without a meal break 
# @rule		they will be paid at {mult_meal_penalty1} (1.5) times the standard rate.
# @rule	If an employee works more than {rule_qty_meal_penalty_2} (7 hours) without a meal break 
# @rule		they will be paid at {mult_meal_penalty2} (2) times the standard rate.
# 
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Preheat variables here
Set Variable [ $start_ts ; Value: $$start_ts ]
# 
#  Prepare a set of variables based on Contract values.  While not necessary, this will make reading/writing the script easier.
Set Variable [ $hrs_before_meal_penalty1 ; Value: GetAsTime ( GLO_TCD_CTR__Contract::hrs_before_meal_penalty1 * 3600 ) ]
Set Variable [ $hrs_before_meal_penalty2 ; Value: If ( IsEmpty ( GLO_TCD_CTR__Contract::hrs_before_meal_penalty2 ); 	GetAsTime ( "24:00" ); 	GetAsTime ( GLO_TCD_CTR__Contract::hrs_before_meal_penalty2 * 3600 ) ) ]
Set Variable [ $mult_meal_penalty1 ; Value: GLO_TCD_CTR__Contract::mult_meal_penalty1 ]
Set Variable [ $mult_meal_penalty2 ; Value: GLO_TCD_CTR__Contract::mult_meal_penalty2 ]
Set Variable [ $hrs_meal_penalty1 ; Value: GLO_TCD_CTR__Contract::hrs_meal_penalty1 ]
Set Variable [ $hrs_meal_penalty2 ; Value: GLO_TCD_CTR__Contract::hrs_meal_penalty2 ]
Set Variable [ $hrs_meal_break_min ; Value: GLO_TCD_CTR__Contract::hrs_meal_break_min ]
# 
#  Assemble a list of Time Card Line IDs without Minimum Calls or Unpaid Meals
Perform Script [ “Create History Variables” ; Specified: From list ; Parameter: Let ( 	~match = List ( 		GFN ( TCL__TimeCardLine::date ); 		GFN ( TCL__TimeCardLine::ignoreMealPenatly ); 		GFN ( TCL__TimeCardLine::isMP1 ); 		GFN ( TCL__TimeCardLine::isMP2 ); 		GFN ( TCL__TimeCardLine::isPaidMeal ); 		GFN ( TCL__TimeCardLine::time_in_ts_c ); 		GFN ( TCL__TimeCardLine::time_out_ts_c ); 	); 	List ( 		"start_date="	& GLO_TCD__TimeCard::date - 1; 		"end_ts="		& $$start_ts; 		"match_fields="	& CF_addPSlashes ( ~match ); 		"sort="			& "DESC"; 	) ) ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Set Variable [ $history_count ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "count" )) ]
If [ $error ]
Set Variable [ $error ; Value: True ]
Exit Loop If [ True ]
End If
# 
// #  The earliest In timestamp from the current Time Card
// Set Variable [ $this_time_in_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( Evaluate ( "$$" & $$this_mode ); GFN ( TCL__TimeCardLine::time_in_ts_c ))) ]
# 
#  Loop through the history "records", looking for a paid or unpaid meal break.
Set Variable [ $i ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i + 1; $i > $history_count ) ]
# 
#  Retrieve a few fields from the current $$history record.
Set Variable [ $history_time_in_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $$history[$i]; GFN ( TCL__TimeCardLine::time_in_ts_c ))) ]
Set Variable [ $history_time_out_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $$history[$i]; GFN ( TCL__TimeCardLine::time_out_ts_c ))) ]
Set Variable [ $history_isPaidMeal ; Value: GetAsBoolean ( CF_getProperty ( $$history[$i]; GFN ( TCL__TimeCardLine::isPaidMeal ))) ]
# 
#  Was there enough time off from the end of this line to the start of the next?
If [ $start_ts - $history_time_out_ts_c ≥ Time ( $hrs_meal_break_min; 0; 0 ) 	or $history_isPaidMeal ]
#  We've gone far enough.  
Exit Loop If [ True ]
Else
#  Update the start time, rinse & repeat.
Set Variable [ $start_ts ; Value: $history_time_in_ts_c ]
End If
End Loop
# 
#  Now that we know how far back in time we need to go, we can clean up some (or all) of the $$history variable(s).
Set Variable [ $null ; Value: CF_ClearRepeatingVariable ( "$$history"; $i; $history_count ) ]
Set Variable [ $history_count ; Value: $i - 1 ]
# 
#  Loop through the history records, totaling worked hours as we go.
Set Variable [ $worked_hours ; Value: 0 ]
Set Variable [ $i ; Value: $history_count + 1 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i - 1; $i < 1 ) ]
# 
#  Retrieve a few fields from the current $$history record.
Set Variable [ $history_time_in_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $$history[$i]; GFN ( TCL__TimeCardLine::time_in_ts_c ))) ]
Set Variable [ $history_time_out_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $$history[$i]; GFN ( TCL__TimeCardLine::time_out_ts_c ))) ]
# 
#  Update the running total
Set Variable [ $worked_hours ; Value: $worked_hours + ( $history_time_out_ts_c - $history_time_in_ts_c ) ]
# 
#  End of History Record loop.
End Loop
# 
# 
#  Having finished analyzing the history records, we are now ready to apply Meal Penalties to the current Time Card's Lines
Set Variable [ $record_count ; Value: Evaluate ( "$$" & $$this_mode & "_count" ) ]
# 
#  Loop through the Bill/Pay repeating variables
Set Variable [ $i ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i + 1; $i > $record_count ) ]
# 
#  Break a few "field" values out into dedicated varaibles.  This will make reading/writing this section much easier, and reduce custom function calls.
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$i]" ) ]
Set Variable [ $this_date ; Value: GetAsDate ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ))) ]
Set Variable [ $this_time_in_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ))) ]
Set Variable [ $this_time_out_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ))) ]
Set Variable [ $this_ignoreMealPenatly ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::ignoreMealPenatly ))) ]
Set Variable [ $this_isPaidMeal ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isPaidMeal ))) ]
Set Variable [ $this_isUnpaidMeal ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isUnpaidMeal ))) ]
Set Variable [ $this_duration ; Value: $this_time_out_ts_c - $this_time_in_ts_c ]
Set Variable [ $this_time_in ; Value: GetAsTime ( $this_time_in_ts_c ) ]
# 
# 
#  If the previous "record" was actually a gap in the timeline, treat it like an unpaid meal.
If [ $last_out_ts 	and $this_time_in_ts_c ≥ $last_out_ts + Time ( $hrs_meal_break_min; 0; 0 ) ]
Set Variable [ $worked_hours ; Value: 0 ]
End If
# 
# 
#  Start to examine each Time Card Line (variable) for their Meal Penalty qualifications.
# 
# 
#  If the current TCL is a meal...
If [ $this_isUnpaidMeal or $this_isPaidMeal ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP2 ); False ) ]
Set Variable [ $worked_hours ; Value: 0 ]
# 
# 
#  If we have been directed to ignore Meal Penalty...
Else If [ $this_ignoreMealPenatly ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP2 ); False ) ]
Set Variable [ $worked_hours ; Value: $worked_hours + $this_duration ]
# 
# 
#  If the current TCL is insufficient to put us over the hrs_before_meal_penalty qty...
Else If [ $worked_hours + $this_duration ≤ $hrs_before_meal_penalty1 ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP2 ); False ) ]
Set Variable [ $worked_hours ; Value: $worked_hours + $this_duration ]
# 
# 
#  If this line is entirely within zone 2...
Else If [ $worked_hours ≥ $hrs_before_meal_penalty2 	and $hrs_before_meal_penalty2 > 0 ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP2 ); True ) ]
Set Variable [ $worked_hours ; Value: $worked_hours + $this_duration ]
# 
# 
#  If this line is entirely within zone 1...
Else If [ $worked_hours ≥ $hrs_before_meal_penalty1 	and ( 	( 		$hrs_before_meal_penalty2 > 0 			and 		$worked_hours + $this_duration ≤ $hrs_before_meal_penalty2 	) 		or 	( 		GetAsBoolean ( $hrs_before_meal_penalty2 ) = False 	) ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP1 ); True ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP2 ); False ) ]
Set Variable [ $worked_hours ; Value: $worked_hours + $this_duration ]
# 
# 
#  Otherwise we need to split the TCL record, at least once.
Else
# 
# 
#  Calculate appropriate out time for the first piece.
Set Variable [ $split_time ; Value: If ( $worked_hours < $hrs_before_meal_penalty1; 	$this_time_in + $hrs_before_meal_penalty1 - $worked_hours; 	$this_time_in + $hrs_before_meal_penalty2 - $worked_hours ) ]
# 
#  Duplicate the current "record".
Perform Script [ “Duplicate Rule Variable” ; Specified: From list ; Parameter: "source=" & $i ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Exit Loop If [ $error ]
# 
#  Modify the current record to end at the appropriate time.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out ); $split_time ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $this_date; $split_time )) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP1 ); $worked_hours ≥ $hrs_before_meal_penalty1 ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP2 ); False ) ]
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
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in ); $split_time ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( $this_date; $split_time )) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP1 ); $worked_hours < $hrs_before_meal_penalty1 ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP2 ); $worked_hours ≥ $hrs_before_meal_penalty1 ) ]
# 
#  Refresh the global variable with the current values contained in $this_record.
Set Variable [ $null ; Value: CF_SetVarByName ("$$" & $$this_mode; $i; $this_record ) ]
# 
# 
#  We MAY need to split the new record if the original record started before MP1, and ended after MP2
If [ $worked_hours < $hrs_before_meal_penalty1 	and $worked_hours + $this_duration > $hrs_before_meal_penalty2 ]
# 
#  Calculate appropriate out time for the second piece.
Set Variable [ $split_time ; Value: $split_time + ( $hrs_before_meal_penalty_2 - $hrs_before_meal_penalty_1 ) ]
# 
#  Duplicate the current "record".
Perform Script [ “Duplicate Rule Variable” ; Specified: From list ; Parameter: "source=" & $i ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Exit Loop If [ $error ]
# 
#  Modify the current record to end at the appropriate time.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out ); $split_time ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $this_date; $split_time )) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP1 ); True ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP2 ); False ) ]
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
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in ); $split_time ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( $this_date; $split_time )) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP2 ); True ) ]
# 
#  Refresh the global variable with the current values contained in $this_record.
Set Variable [ $null ; Value: CF_SetVarByName ("$$" & $$this_mode; $i; $this_record ) ]
# 
End If
End If
# 
# 
#  Remember the last OUT time, so that it can be compared with the next IN time, watching for (unpaid meal) gaps
Set Variable [ $last_out_ts ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ))) ]
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
#  Clean up the $$history variables.
Set Variable [ $null ; Value: CF_ClearRepeatingVariable ( "$$history"; 1; $history_count ) ]
# 
#  Cleanup steps: close worker windows, gather script results, etc...
Set Variable [ $result ; Value: List	( 	"error="			& If ( IsEmpty ( $error ); 0; $error ); 	"message="		& CF_addPSlashes ( $message ); 	"scriptName="	& Get ( ScriptName ); ) ]
# 
#  That's it - exit script!
Exit Script [ Text Result: $result		//  We always return the result variable  ]
# 

```
