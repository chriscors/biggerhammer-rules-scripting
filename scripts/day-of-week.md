# Day of Week

> Premium for specific days of the week (weekends, holidays, etc.)

## Script Text

```
# # Day of Week
#  Any work performed on the specifified day(s) is paid at {multiplier} until a higher rate is earned.
#  As a Modular script, several assumtions have been made.
#  As a PSOS script, we want to avoid opening windows, and ALL user interactions..
# 
# @history
#  12/05/2017 - Marc Berning - Initial Version
#  05/25/2018 - Marc Berning - Added Flat Rate check - not sure this is correct.
# 
# @assumptions
#  Context: We are already oriented to a Globals-based layout.
#  Environment: Allow User Abort & Error Capture states are appropriately set.
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# 
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Preheat variables here
Set Variable [ $rule_name ; Value: "Day of Week" ]
Set Variable [ $record_count ; Value: Evaluate ( "$$" & $$this_mode & "_count" ) ]
# 
#  Figure out if we have a matching day in the rules.
Set Variable [ $rule_values ; Value: Let ( 	~rules = CF_GetArrayColumn ( $$contract_rules; 1; "∞" ); 	CF_ListValuePositions ( ~rules; "name=" & $rule_name ; "" ) ) ]
Exit Loop If [ IsEmpty ( $rule_values ) ]
# 
#  Loop through the values, extracting just the "Day of Week" record ONLY if we find a matching day.
Set Variable [ $i ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i + 1; $i > ValueCount ( $rule_values )) ]
Set Variable [ $rule_record ; Value: Let ([ 	~record	= Substitute ( GetValue ( $$contract_rules; GetValue ( $rule_values; $i )); "∞"; ¶ ); 	~day		= CF_getProperty ( ~record; "day" ); 	~dow		= Case ( 				~day = "Sunday"; 1; 				~day = "Monday"; 2; 				~day = "Tuesday"; 3; 				~day = "Wednesd… ]
Exit Loop If [ $rule_record ]
End Loop
# 
#  If we exited the above loop without finding a rule match...
Exit Loop If [ IsEmpty ( $rule_record ) ]
Exit Loop If [ Let ( 	~s = CF_getProperty ( $rule_record; "scope" ); 	not IsEmpty ( ~s ) and not PatternCount ( ~s; $$this_mode ) ) ]
# 
#  Extract the Multiplier from the rule.
Set Variable [ $hrs_dayofweek ; Value: CF_getProperty ( $rule_record; "hour1" ) ]
Set Variable [ $mult_dayofweek ; Value: GetAsNumber ( CF_getProperty ( $rule_record; "mult1" )) ]
Set Variable [ $mult_overtime_daily_L1 ; Value: GLO_TCD_CTR__Contract::mult_overtime_daily_L1 ]
Set Variable [ $mult_overtime_daily_L2 ; Value: GLO_TCD_CTR__Contract::mult_overtime_daily_L2 ]
Set Variable [ $mult_overtime_weekly ; Value: GLO_TCD_CTR__Contract::mult_overtime_weekly ]
# 
#  Loop through the Time Card Lines
Set Variable [ $i ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i + 1; $i > $record_count ) ]
# 
#  Isolate the current "record"  This will make reading/writing this script much easier, and reduce custom function calls.
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$i]" ) ]
Set Variable [ $this_isMinimumCall ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isMinimumCall ))) ]
Set Variable [ $this_isMP1 ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isMP1 ))) ]
Set Variable [ $this_isMP2 ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isMP2 ))) ]
Set Variable [ $this_isOTDailyL1 ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ))) ]
Set Variable [ $this_isOTDailyL2 ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ))) ]
Set Variable [ $this_isOTWeekly ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isOTWeekly ))) ]
Set Variable [ $this_isUnpaidMeal ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isUnpaidMeal ))) ]
# 
#  If the current record is an unpaid meal...
If [ $this_isUnpaidMeal ]
#  skip it.
# 
#  If the current record is a Minimum Call...
Else If [ $this_isMinimumCall ]
#  skip it.
# 
Else
#  Change the current record's field(s).
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isDayOfWeek ); True ) ]
# 
#  If the record has already been identified as OT Level 2...
If [ $this_isOTDailyL2 ]
#  there's nothing more to do.
# 
#  If this is already identified as OT Level 1, and that matches the Consecutive Day multiplier...
Else If [ $this_isOTDailyL1 	and $mult_overtime_daily_L1 = $mult_dayofweek ]
#  there's nothing more to do.
# 
#  If this is already identified as Weekly OT, and that matches the Consecutive Day multiplier...
Else If [ $this_isOTWeekly 	and $mult_overtime_weekly = $mult_dayofweek ]
#  there's nothing more to do.
# 
#  If the day's multiplier qualifies us for Level 2 OT...
Else If [ $mult_dayofweek = $mult_overtime_daily_L2 ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); True ) ]
# 
#  If the day's multiplier qualifies us for Level 1 OT...
Else If [ $mult_dayofweek = $mult_overtime_daily_L1 ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); True ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); False ) ]
# 
End If
# 
#  Commit the changes back to the master global variable.
Set Variable [ $null ; Value: CF_SetVarByName ( "$$" & $$this_mode; $i; $this_record ) ]
End If
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
