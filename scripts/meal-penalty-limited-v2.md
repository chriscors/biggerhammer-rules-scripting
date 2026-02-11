# Meal Penalty - Limited V2 (Definitive)

> Additive meal penalty — accumulates premium minutes post-loop

## Script Text

```
# # Meal Penalty Limited V2
#  Applies Meal Penalty rules to the Time Card Lines 
#  As a modular script, several assumptions will be made regarding the context & environment.
#  As a PSOS script, we want to avoid opening windows, and ALL user interactions..
# 
# @history
#  08/15/2018 - Marc Berning - initial version.
# 
# @assumptions
#  Context: We are already oriented to a Globals-based layout.
#  Context: The "current" Time Card is & its related Contract is available via the GLO_TCD__Timecard and GLO_TCD_CTR__Contract relationships.
#  Environment: Allow User Abort & Error Capture states are appropriately set.
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# 
# @rule	If crew do not receive a meal break after (5) hours, crew will receive a premium equal to (1) hour of pay.
# 
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Preheat variables here
Set Variable [ $rule_name ; Value: "Meal Penalty (limited)" ]
Set Variable [ $start_ts ; Value: $$start_ts ]
# 
#  Collect rule-specific values from the rule record, and from the Contract record.
Set Variable [ $rule_values ; Value: Let ([ 	~rules	= CF_GetArrayColumn ( $$contract_rules; 1; "∞" ); 	~pos		= CF_ListValuePositions ( ~rules; "name=" & $rule_name; "" ); 	~rule	= GetValue ( $$contract_rules; GetValue ( ~pos; 1 )) ]; 	Substitute ( ~rule; "∞"; ¶ ) ) ]
Exit Loop If [ IsEmpty ( $rule_values ) ]
Exit Loop If [ Let ( 	~s = CF_getProperty ( $rule_values; "scope" ); 	not IsEmpty ( ~s ) and not PatternCount ( ~s; $$this_mode ) ) ]
Set Variable [ $hrs_before_meal_penalty1 ; Value: Time ( CF_getProperty ( $rule_values; "hour1" ); 0; 0 ) ]
Set Variable [ $hrs_meal_penalty1 ; Value: GetAsNumber ( CF_getProperty ( $rule_values ; "hour2" )) ]
Set Variable [ $hrs_meal_break_min ; Value: Time ( Max ( GLO_TCD_CTR__Contract::hrs_meal_break_min; 0 ); 0; 0 ) ]
# 
#  Assemble a list of Time Card Line IDs (without Minimum Calls or Unpaid Meals) from before the start of this time card.
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
If [ $history_isPaidMeal 	or $start_ts - $history_time_out_ts_c ≥ $hrs_meal_break_min ]
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
Set Variable [ $this_time_in_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ))) ]
Set Variable [ $this_time_out_ts_c ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ))) ]
Set Variable [ $this_ignoreMealPenatly ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::ignoreMealPenatly ))) ]
Set Variable [ $this_isPaidMeal ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isPaidMeal ))) ]
Set Variable [ $this_isUnpaidMeal ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isUnpaidMeal ))) ]
Set Variable [ $this_duration ; Value: $this_time_out_ts_c - $this_time_in_ts_c ]
// Set Variable [ $this_isFlat ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isFlat ))) ]
# 
// #  A Time Card with a Show Call (isFlat) does not qualify for Meal Penalyies
// If [ $this_isFlat ]
// Set Variable [ $worked_hours ; Value: "" ]
// Set Variable [ $premium_minutes ; Value: "" ]
// Exit Loop If [ True ]
// End If
# 
#  If the previous "record" was actually a gap in the timeline (of sufficient length), treat it like an unpaid meal.
If [ $last_out_ts 	and $this_time_in_ts_c ≥ $last_out_ts + $hrs_meal_break_min ]
#  Track the quantity of "penalty" minutes worked.
Set Variable [ $premium_minutes ; Value: $premium_minutes + Max ( 0; $worked_hours - $hrs_before_meal_penalty1 ) ]
#  Reset the running total of time worked.
Set Variable [ $worked_hours ; Value: 0 ]
End If
# 
#  In Meal Penalty - Additive, the "regular" TCL is never marked as a Meal Penalty.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP2 ); False ) ]
# 
#  If the current TCL is a meal...
If [ $this_isUnpaidMeal or $this_isPaidMeal ]
# 
#  Track the quantity of "penalty" minutes worked.
Set Variable [ $premium_minutes ; Value: $premium_minutes + Max ( 0; $worked_hours- $hrs_before_meal_penalty1 ) ]
#  Reset the running total of time worked.
Set Variable [ $worked_hours ; Value: 0 ]
# 
#  If we have been directed to ignore Meal Penalty...
Else If [ $this_ignoreMealPenatly ]
#  We don't include the current duration in the $work_hours total.
# 
Else
Set Variable [ $worked_hours ; Value: $worked_hours + $this_duration ]
End If
# 
#  Remember the last OUT time, so that it can be compared with the next IN time, watching for (unpaid meal) gaps
Set Variable [ $last_out_ts ; Value: GetAsTimestamp ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ))) ]
# 
#  End of record loop
End Loop
# 
#  Track the quantity of "penalty" minutes worked.
Set Variable [ $premium_minutes ; Value: $premium_minutes + Max ( 0; $worked_hours - $hrs_before_meal_penalty1 ) ]
# 
#  If we acculumated any penalty minutes ...
If [ $premium_minutes ]
# 
#  Create an Unworked record
Perform Script [ “Create Unworked Entry” ; Specified: From list ; Parameter: List ( 	"source="		& CF_addPSlashes ( Evaluate ( "$$" & $$this_mode & "[1]" )); 	"hrsUnworked="	& $hrs_meal_penalty1; 	"incl_NT="		& False; 	"incl_OT="		& False; 	"isMP1="			& True; 	"isMinimumCall="	& False; ) ]
# 
End If
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
