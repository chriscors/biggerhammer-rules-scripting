# Consecutive Days - BH

> Premium for working consecutive days (MINOR BUG: uses $ordinal instead of $next_ordinal)

## Script Text

```
# # Consecutive days
#  All work performed on the specifified day is paid at {multiplier} until a higher rate is earned.
#  As a Modular script, several assumtions have been made.
#  As a PSOS script, we want to avoid opening windows, and ALL user interactions..
# 
# @history
#  03/01/2018 - Marc Berning - Initial Version
# 
# @assumptions
#  Context: We are already oriented to a Globals-based layout.
#  Environment: Allow User Abort & Error Capture states are appropriately set.
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# 
# @rule	All work performed on the {ordinal} consecutive day of employment shall be paid at a rate of {multiplier} times the base rate.
# 
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Preheat variables here
Set Variable [ $rule_name ; Value: "Consecutive Days" ]
Set Variable [ $match ; Value: False ]
Set Variable [ $record_count ; Value: Evaluate ( "$$" & $$this_mode & "_count" ) ]
# 
#  Extract a few values from the first record.
Set Variable [ $this_date ; Value: GLO_TCD__TimeCard::date ]
Set Variable [ $this_contact_id ; Value: GLO_TCD__TimeCard::_contact_id ]
# 
#  Figure out if we have a matching day in the rules.
Set Variable [ $rule_values ; Value: Let ( 	~rules	= CF_GetArrayColumn ( $$contract_rules; 1; "∞" ); 	CF_ListValuePositions ( ~rules; "name=" & $rule_name ; "" ) ) ]
Exit Loop If [ IsEmpty ( $rule_values ) ]
# 
#  Loop through the rules, looking for _The_One_ that would apply to our situation.
Set Variable [ $i ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i + 1; $i > ValueCount ( $rule_values )) ]
Set Variable [ $next_rule ; Value: Substitute ( GetValue ( $$contract_rules; GetValue ( $rule_values; $i )); "∞"; ¶ ) ]
If [ Let ( 	~s = CF_getProperty ( $next_rule; "scope" ); 	IsEmpty ( ~s ) or PatternCount ( ~s; $$this_mode ) ) ]
Set Variable [ $next_ordinal ; Value: Let ( 	~day = CF_getProperty ( $next_rule ; "ordinal" ); 	Case ( 		~day = "eighth";		8; 		~day = "seventh";	7; 		~day = "sixth";		6; 		~day = "fifth";		5; 		~day = "fourth";		4; 		~day = "third";		3; 		~day = "second";		2; 		0 	) ) ]
Set Variable [ $next_start_of_work ; Value: CF_getProperty ( $next_rule ; "day" ) ]
Set Variable [ $rule_operation ; Value: CF_getProperty ( $next_rule ; "operation" ) ]
#  If the Contract Rule specifies that the nth day is calculated from the employees last day off...
If [ $next_start_of_work = "Work" ]
#  Calculate an appropriate start date based on the Start of Work value.
Set Variable [ $date_list ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::_contact_id ); 	~date	= SQLField ( TCL__TimeCardLine::date ); 	~query	= "SELECT DISTINCT " & ~date & 				" FROM " & ~table & 				" WHERE " & 					~id & " = ?" & … ]
Exit Loop If [ CF_SQLErrorCheck ( "$date_list" ) ]
Exit Loop If [ ValueCount ( $date_list ) + 1 < $next_ordinal ]
#  Loop through the dates, counting the number of sequentially worked days
Set Variable [ $days_ago ; Value: 0 ]
Loop [ Flush: Always ]
Set Variable [ $days_ago ; Value: $days_ago + 1 ]
Exit Loop If [ If ( $days_ago > ValueCount ( $date_list ); 	Let ( $days_ago = $days_ago - 1; True ); 	False ) /* 	If we ran out of date values, subtract 1 from $days_ago so that it accurately reflects the # of days in the list. */ ]
Exit Loop If [ CF_DateFromUnix ( GetValue ( $date_list ; $days_ago )) < ( $this_date - $days_ago ) ]
End Loop
Set Variable [ $match ; Value: Mod ( $days_ago + 1; 7 ) = Mod ( $next_ordinal; 7 ) ]
Exit Loop If [ $match ]
Else
#  Assemble a list of recent dates worked by the current contact.
Set Variable [ $start_date ; Value: Let ([ 	~weekday = If ( $next_start_of_work = "Week"; GLO_TCD_CTR__Contract::start_of_week; $next_start_of_work ); 	~dow = DayOfWeek ( $this_date ); 	~sow = Case ( 		~weekday	= "Event";		DayOfWeek ( GLO_TCD_EVE__Event::Date_Start ); 		~weekday	= "Sunday"… ]
#  If the start_date is a match for the rule... We found THE appropriate rule.  Exit the loop
Set Variable [ $match ; Value: $start_date + ( $next_ordinal - 1 ) = $this_date ]
Exit Loop If [ $match ]
End If
End If
End Loop
# 
#  If we did not find a $match, this rule does not need to be run.
Exit Loop If [ not $match ]
# 
#  If the start_of_work = "work", we have already confirmed that this Time Card is qualified
If [ $next_start_of_work ≠ "Work" ]
# 
#  Look to history to determine if this employee worked a sufficient number of consecutive days.
If [ $$this_mode = "bill" ]
If [ $$bill_scope = "Event" ]
Set Variable [ $historical_tcl ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::_contact_id ); 	~event	= SQLField ( TCL__TimeCardLine::_event_id ); 	~date	= SQLField ( TCL__TimeCardLine::date ); 	~query	= "SELECT DISTINCT " & ~date & 				" F… ]
Else If [ $$bill_scope = "Client" ]
Set Variable [ $historical_tcl ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::_contact_id ); 	~client	= SQLField ( TCL__TimeCardLine::_company_id ); 	~date	= SQLField ( TCL__TimeCardLine::date ); 	~query	= "SELECT DISTINCT " & ~date & 				… ]
Else If [ $$bill_scope = "Employer" ]
Set Variable [ $historical_tcl ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::_contact_id ); 	~vendor	= SQLField ( TCL__TimeCardLine::_vendor_id ); 	~date	= SQLField ( TCL__TimeCardLine::date ); 	~query	= "SELECT DISTINCT " & ~date & 				"… ]
End If
Else
Set Variable [ $historical_tcl ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::_contact_id ); 	~date	= SQLField ( TCL__TimeCardLine::date ); 	~expense	= SQLField ( TCL__TimeCardLine::isExpense ); 	~today	= GLO_TCD__TimeCard::date; 	~query	=… ]
End If
# 
#  Validate the SQL
Exit Loop If [ CF_SQLErrorCheck ( "$historical_tcl" ) ]
Exit Loop If [ ValueCount ( $historical_tcl ) < $next_ordinal - 1 ]
End If
# 
#  Loop through the Time Card Lines
Set Variable [ $i ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i + 1; $i > $record_count ) ]
# 
#  Isolate the current "record"  This will make reading/writing this script much easier, and reduce custom function calls.
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$i]" ) ]
Set Variable [ $this_isMinimumCall ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isMinimumCall ))) ]
Set Variable [ $this_isUnpaidMeal ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isUnpaidMeal ))) ]
# 
#  If the current record is an unpaid meal...
If [ $this_isUnpaidMeal ]
#  skip it.
# 
#  If the current record is a Minimum Call, and we are supposed to EXCLUDE minimums...
Else If [ $this_isMinimumCall 	and $rule_operation = "excluding" ]
#  skip it.
# 
Else
#  Change the current record's appropriate (6th, 7th, 8th) field.
Set Variable [ $this_record ; Value: Let ([ 	~name = GFN ( TCL__TimeCardLine::isConsecutiveDay6th ); 	~len = Length ( ~name ); 	~name = Left ( ~name ; ~len - 3 ) & CF_Ordinal ( $next_ordinal ) ]; 	CF_setPropertyValue ( $this_record; ~name ; True ) ) ]
# 
#  Commit the changes back to the master global variable.
Set Variable [ $null ; Value: CF_SetVarByName ( "$$" & $$this_mode; $i; $this_record ) ]
End If
# 
#  End of Time Card Line loop
End Loop
# 
#  Depending on the Client Preferences, we may need to loop through the UnWorked records too.
If [ $rule_operation = "including" 	and $$unwork_count > 0 ]
# 
#  Loop through each "record" - whick is still a repeating variable
Set Variable [ $j ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $j = $j + 1; $j > $$unwork_count ) ]
Set Variable [ $this_record ; Value: Evaluate ( "$$unwork[" & $j & "]" ) ]
Set Variable [ $this_isMealPenalty ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isMP1 ))) 	or GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isMP2 ))) ]
# 
#  Skip Meal Penalty records
If [ $this_isMealPenalty ]
#  skip it.
# 
Else
Set Variable [ $this_isBill ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isBill ))) ]
Set Variable [ $this_isPay ; Value: GetAsBoolean ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::isPay ))) ]
If [ ( $this_isBill and $$this_mode = "bill" ) 	or ( $this_isPay  and $$this_mode = "pay" ) ]
# 
#  Change the current record's appropriate (6th, 7th, 8th) field.
Set Variable [ $this_record ; Value: Let ([ 	~name = GFN ( TCL__TimeCardLine::isConsecutiveDay6th ); 	~len = Length ( ~name ); 	~name = Left ( ~name ; ~len - 3 ) & CF_Ordinal ( $ordinal ) ]; 	CF_setPropertyValue ( $this_record; ~name ; True ) ) ]
# 
#  Commit the changes back to the master global variable.
Set Variable [ $null ; Value: CF_SetVarByName ( "$$unwork"; $j; $this_record ) ]
End If
End If
End Loop
End If
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
