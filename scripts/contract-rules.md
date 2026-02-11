# Contract Rules (Scripting File)

> Phase 2 orchestrator — runs all rule sub-scripts in sequence per TCD

## Script Text

```
# #
#  Applies Contract Rules, appropriate for each Time Card.
#  This script directs sub-script execution appropriate for each time card.
# 
# @history
#  11/15/2016 - Marc Berning - Initial Version
#  03/30/2017 - Marc Berning - Added call to sub-script to create/modify Time Card Line Aux records.
#  05/31/2017 - Marc Berning - Added Clock record validation.
#  04/24/2019 - Marc Berning - Added ratings parameter.
#  09/11/2020 - Marc Berning - Assemble a list of non-estimate Events if running payable rules and if contract includes "Payable Calculation Scope" rule.
# 05/25/2023 - Heather Williams - General cleanup and...
# 
# @param text $timecard_ids (req): unique IDs of the Time Card record(s) to be processed.
# @param enum $mode (req): Mode of Rule processing.  Valid values: "Bill", "Pay"
# @param enum $bill_scope_actual (req): Scope of Billable calcualtions for "real" events.  one of: Client, Event or Employer
# @param enum $bill_scope_estimate (req): Scope of Billable calcualtions for isEstimate events.  one of: Client, Event or Employer
# @param bool $omit_unpd (opt): If True, Unpaid Meals are omitted from the Billable & Payable record set. Default is False
# @param bool $ratings (opt): Boolean indicating if Ratings are enabled. Default is TRUE
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# @return text $success_ids (cond): Delimited list of Time Card IDs that were successfully processed.
# 
# 
#  Required settings - do not modify!
Set Variable [ $errorCaptureOn ; Value: Get ( ErrorCaptureState ) ]
Set Variable [ $userAbortOn ; Value: Get ( AllowAbortState ) ]
#  Set as needed
Allow User Abort [ Off ]
Set Error Capture [ On ]
# 
#  Preheat variables here
Set Variable [ $startTime ; Value: Get ( CurrentTimeUTCMilliseconds ) ]
Set Variable [ $process_timer ; Value: $startTime ]
Set Variable [ $originalLayout ; Value: Get ( LayoutName ) ]
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Parse out script parameters here.
Set Variable [ $scriptParams ; Value: Get ( ScriptParameter ) ]
Set Variable [ $timecard_ids ; Value: CF_getProperty ( $scriptParams; "timecard_id" ) ]
Set Variable [ $mode ; Value: CF_getProperty ( $scriptParams; "mode" ) ]
Set Variable [ $omit_unpd ; Value: Let ( 	~o = CF_getProperty ( $scriptParams; "omit_unpd" ); 	If ( IsEmpty ( ~o ); False; GetAsBoolean ( ~o )) ) ]
Set Variable [ $ratings ; Value: Let ( 	~o = CF_getProperty ( $scriptParams; "ratings" ); 	If ( IsEmpty ( ~o ); True; GetAsBoolean ( ~o )) ) ]
If [ Get ( LastError ) ]
Set Variable [ $error ; Value: Get ( LastError ) ]
Set Variable [ $message ; Value: "Could not process script's parameters, possibly due to missing Custom Functions." ]
Exit Loop If [ True ]
End If
# 
#  Validate required parameters
If [ IsEmpty ( $timecard_ids ) ]
Set Variable [ $error ; Value: 1201 ]
Set Variable [ $message ; Value: "Missing required parameter: timecard_ids" ]
End If
If [ Let ( 	n = ValueCount ( FilterValues ( $mode; "Bill¶Pay" )); 	n < 1 or n > 2 ) ]
Set Variable [ $error ; Value: 1201 ]
Set Variable [ $message ; Value: List ( 	$message; 	"Missing or invalid required parameter: mode" ) ]
End If
Exit Loop If [ $error ]
# 
#  Reorient ourselves to an appropriate layout
If [ CF_isDevServer ]
Go to Layout [ “@GLO__Gobal” (GLO__Global) ; Animation: None ]
Else
Go to Layout [ “GLO__Gobal” (GLO__Global) ; Animation: None ]
End If
Exit Loop If [ CF_ErrorOut ( Get ( LastError )) ]
# 
#  If Ratings are enabled...
If [ $ratings ]
#  Collect a list of Rating IDs that are eligable for Billable & Payable proocessing.
Set Variable [ $rating_ids ; Value: Let ([ 	~table	= SQLTable ( RAT__Rating::__id ); 	~id		= SQLField ( RAT__Rating::__id ); 	~bill	= SQLField ( RAT__Rating::bill ); 	~pay		= SQLField ( RAT__Rating::pay ); 	~query	= "SELECT" & 				" CASE WHEN " & ~bill & " = 'R' THEN " & ~id & " ELSE '' EN… ]
Exit Loop If [ CF_SQLErrorCheck ( "$rating_ids" ) ]
Set Variable [ $bill_apply_rule_ids ; Value: CF_GetArrayColumn ( $rating_ids; 1; "," ) ]
Set Variable [ $bill_copy_clock_ids ; Value: CF_GetArrayColumn ( $rating_ids; 2; "," ) ]
Set Variable [ $pay_apply_rule_ids ; Value: CF_GetArrayColumn ( $rating_ids; 3; "," ) ]
Set Variable [ $pay_copy_clock_ids ; Value: CF_GetArrayColumn ( $rating_ids; 4; "," ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	$process_log & elapsed & Tab & "Preamble" & ¶ ) ]
End If
# 
#  Loop through the list of supplied Time Card IDs
Set Variable [ $tcd_count ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $tcd_count = $tcd_count + 1; $tcd_count > ValueCount ( $timecard_ids )) ]
# 
#  An inner Time Card loop will allow us to exit the current Time Card due to an error, but continue with the remaning Time Cards.
Loop [ Flush: Always ]
# 
#  Isolate the next contestant, set a global field to form a relationship to the Time Card record.
Set Variable [ $$timecard_id ; Value: GetValue ( $timecard_ids; $tcd_count ) ]
Set Field [ GLO__Global::_id_g ; ""		//  Clear the value to reset any pre-existing relationship ]
Set Field [ GLO__Global::_id_g ; $$timecard_id ]
If [ IsEmpty ( GLO_TCD__TimeCard::__id ) ]
Set Variable [ $message ; Value: "Invalid Time Card ID." ]
Exit Loop If [ Let ( $error = True; True ) ]
End If
# 
#  Identify the card's earliest IN and OUT timestamps - needed to accurately collect history data.
Set Variable [ $in_out_ts ; Value: Let ([ 	~table =		SQLTable ( TCL__TimeCardLine::__id ); 	~tcd_id =	SQLField ( TCL__TimeCardLine::_timecard_id ); 	~in_ts =		SQLField ( TCL__TimeCardLine::time_in_ts_c ); 	~out_ts =	SQLField ( TCL__TimeCardLine::time_out_ts_c ); 	~is_bill =	SQLField ( TCL… ]
Exit Loop If [ CF_SQLErrorCheck ( "$in_out_ts" ) ]
Exit Loop If [ IsEmpty ( $in_out_ts ) ]
Set Variable [ $$start_ts ; Value: CF_TsFromUnix ( GetValue ( $in_out_ts; 1 )) ]
Set Variable [ $$end_ts ; Value: CF_TsFromUnix ( GetValue ( $in_out_ts; 2 )) ]
# 
#  Store a few worthwhile values in globals
Set Variable [ $$bill_scope ; Value: If ( GLO_TCD_EVE__Event::isEstimate ; 	CF_getProperty ( $scriptParams ; "bill_scope_estimate" ); 	CF_getProperty ( $scriptParams ; "bill_scope_actual" ) ) //  CF_getProperty ( $scriptParams; "bill_scope" ) ]
Set Variable [ $$company_id ; Value: GLO_TCD_TCL__TimeCardLine::_company_id ]
Set Variable [ $$contact_id ; Value: GLO_TCD__TimeCard::_contact_id ]
Set Variable [ $$event_id ; Value: GLO_TCD__TimeCard::_event_id ]
Set Variable [ $$vendor_id ; Value: GLO_TCD__TimeCard::_vendor_id ]
# 
#  If the contract indicates anything other than an explicit No ...
If [ GLO_TCD_CTR__Contract::require_CJT ≠ 0 ]
#  .. check that the Clock records all have job titles.
Set Variable [ $blank_count ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~cjt_id	= SQLField ( TCL__TimeCardLine::_contractJobTitle_id ); 	~is_bill	= SQLField ( TCL__TimeCardLine::isBill ); 	~is_pay	= SQLField ( TCL… ]
Exit Loop If [ CF_SQLErrorCheck ( "$blank_count" ) ]
If [ $blank_count ]
Set Variable [ $message ; Value: "Missing Job Title" & If ( $missing_count > 1; "s" ) ]
Exit Loop If [ Let ( $error = True; True ) ]
End If
End If
# 
#  If the contract indicates anything other than an explicit No ...
If [ Let ( 	~validate = If ( GetAsBoolean ( GLO_TCD_EVE__Event::isEstimate ); 		GLO_TCD_CTR__Contract::validate_continuity_estimate; 		GLO_TCD_CTR__Contract::validate_continuity_actual 	); 	not IsEmpty ( $$start_ts ) 		and 	not IsEmpty ( $$end_ts ) 		and 	~validate ≠ 0 		and 	~validate ≠ "none" ) ]
#  ... check that the current Employee has no overlapping times on any Time Card Lines of this day.
Perform Script [ “Validate Time Card” ; Specified: From list ; Parameter: List ( 	"contact_id="	& $$contact_id; 	"date="			& GLO_TCD__TimeCard::date; 	"start_ts="		& $$start_ts; 	"end_ts="		& $$end_ts; ) ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
If [ $error = -1		//  No Time Card Line clock records to process ]
Set Variable [ $error ; Value: 0 ]
Exit Loop If [ True ]
End If
Exit Loop If [ $error ]
End If
# 
#  Assemble a blob of rule records from the Time Card's contract.
Set Variable [ $$contract_rules ; Value: Let ([ 	~cru			= SQLTable ( CRU__ContractRule::__id ); 	~cont		= "c." & SQLField ( CRU__ContractRule::_contract_id ); 	~rule_id		= "c." & SQLField ( CRU__ContractRule::_rule_id ); 	~seq			= "c." & SQLField ( CRU__ContractRule::sequence ); 	~bill1		= "c."… ]
Exit Loop If [ CF_SQLErrorCheck ( "$$contract_rules" ) ]
Set Variable [ $contract_rule_names ; Value: Substitute ( CF_GetArrayColumn ( $$contract_rules; 1; "∞" ); "name="; "" ) ]
If [ Int ( Get ( ApplicationVersion )) ≥ 19 ]
Execute FileMaker Data API [ Select ; Target: $$contract_rules_JSON ; JSONSetElement ( "{}" ; 	[ "layouts" ; "api.CRU__ContractRule" ; JSONString ] ; 	[ "query[0]." & GFN ( CRU__ContractRule::_contract_id ) ; GLO_TCD__TimeCard::_contract_id ; JSONString ] ) ]
// Set Variable [ $contract_rule_names ; Value: JSONQuery ( $$contract_rules_JSON ; "name" ; "MATCH_ALL" ; $rule_name ; JSONString ; "List ( name )" ) ]
Else
#  Test - Assemble rule records from the Time Card's contract into JSON
Set Variable [ $$contract_rules_JSON ; Value: JSON.ArrayFromRelated ( GLO_TCD_CRU__ContractRule::json_c ) ]
// Set Variable [ $contract_rule_names ; Value: JSONQuery ( $$contract_rules_JSON ; "name" ; "MATCH_ALL" ; $rule_name ; JSONString ; "List ( name )" ) ]
End If
# 
#  If we will be running Pay-mode, get a list of non-estimate event IDs with which the current contact was involved.
If [ ValueCount ( FilterValues ( $mode ; "pay" )) 	and ValueCount ( FilterValues ( $contract_rule_names ; "Payable Calculation Scope" )) ]
Set Variable [ $$event_ids ; Value: Let ([ 	~t.table		= "t." & SQLTable ( TCL__TimeCardLine::__id ); 	~t.con_id	= "t." & SQLField ( TCL__TimeCardLine::_contact_id ); 	~t.eve_id	= "t." & SQLField ( TCL__TimeCardLine::_event_id ); 	~t.date		= "t." & SQLField ( TCL__TimeCardLine::date ); 	~t.… ]
Exit Loop If [ CF_SQLErrorCheck ( "$$event_ids" ) ]
#  Clear out duplicates
Set Variable [ $$event_ids ; Value: CF_Trim4 ( UniqueValues ( $$event_ids )) ]
Set Variable [ $$excludeEstimatesFromPayable ; Value: True ]
End If
# 
#  Loop through each of the possible Modes: Bill & Pay
Set Variable [ $mode_count ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $mode_count = $mode_count + 1; $mode_count > ValueCount ( $mode )) ]
Set Variable [ $$this_mode ; Value: GetValue ( $mode; $mode_count ) ]
# 
#  An inner Mode loop so we can optionally exit the first mode and not the second.
Loop [ Flush: Always ]
# 
#  Early exit if the current employee's rating is not eligable for the current mode
If [ $ratings 	and $$this_mode = "bill" 	and ValueCount ( FilterValues ( GLO_TCD__TimeCard::_employeeRating_id; $bill_apply_rule_ids )) = 0 	and ValueCount ( FilterValues ( GLO_TCD__TimeCard::_employeeRating_id; $bill_copy_clock_ids )) = 0 ]
Exit Loop If [ Let ( $error = -1; True ) ]
Else If [ $ratings 	and $$this_mode = "pay" 	and ValueCount ( FilterValues ( GLO_TCD__TimeCard::_employeeRating_id; $pay_apply_rule_ids )) = 0 	and ValueCount ( FilterValues ( GLO_TCD__TimeCard::_employeeRating_id; $pay_copy_clock_ids )) = 0 ]
Exit Loop If [ Let ( $error = -1; True ) ]
End If
# 
#  Create a set of global variables that the rules will process instead of Time Card Line records.
Perform Script [ “Create Rule Variables” ; Specified: From list ; Parameter: "omit_unpd="	& $omit_unpd ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
Exit Loop If [ $error ]
Set Variable [ $null ; Value: CF_SetVarByName ( "$$" & $$this_mode & "_count"; 1; GetAsNumber ( CF_getProperty ( $scriptResult ; "count" ))) ]
# 
#  Early exit if the current employee's rating is not eligable for Rule Processing
If [ $ratings 	and $$this_mode = "bill" 	and ValueCount ( FilterValues ( GLO_TCD__TimeCard::_employeeRating_id; $bill_apply_rule_ids )) = 0 ]
Exit Loop If [ Let ( $error = -1; True ) ]
Else If [ $ratings 	and $$this_mode = "pay" 	and ValueCount ( FilterValues ( GLO_TCD__TimeCard::_employeeRating_id; $pay_apply_rule_ids )) = 0 ]
Exit Loop If [ Let ( $error = -1; True ) ]
End If
# 
#  Midnight Split
Perform Script [ “Midnight Split” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
Exit Loop If [ $error ]
# 
#  Meal Penalties
If [ ValueCount ( FilterValues ( "Meal Penalty (definitive)"; $contract_rule_names )) ]
Perform Script [ “Meal Penalty - limited, v2” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
Else If [ Length ( GLO_TCD_CTR__Contract::hrs_before_meal_penalty1 ) 	and ( 	Length ( GLO_TCD_CTR__Contract::mult_meal_penalty1 ) 		or 	Length ( GLO_TCD_CTR__Contract::hrs_meal_penalty1 ) ) ]
If [ GLO_TCD_CTR__Contract::hrs_meal_penalty1 > 0 ]
Perform Script [ “Meal Penalty - limited” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
Else If [ GLO_TCD_CTR__Contract::mult_meal_penalty1 > 1 ]
Perform Script [ “Meal Penalty - multiplicative” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
End If
End If
Exit Loop If [ $error ]
# 
# 
#  Minimum Call
#  KL 3/21/22 Previous Minimum Call rule did not work after BH changed setting for Minimums are Worked Time = No in January 2022.  While they technically don't need 2-tier minimum call, the YBCA version worked.
// If [ ValueCount ( FilterValues ( "Minimum Call"; $contract_rule_names )) ]
// Perform Script [ “Minimum Call - BH” ; Specified: From list ; Parameter:    ]
# 
If [ ValueCount ( FilterValues ( "Minimum Calls"; $contract_rule_names )) ]
Perform Script [ “Minimum Calls - BH” ; Specified: From list ; Parameter:    ]
# HW 2023-May-24: Testing
// Perform Script [ “Minimum Calls - YBCA NEW FOR BH 03192022” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
Else If [ GLO_TCD_CTR__Contract::hrs_minimum_call > 0 ]
// Perform Script [ “Minimum Call” ; Specified: From list ; Parameter:    ]
Perform Script [ “Minimum Call - BH” ; Specified: From list ; Parameter:    ]
# HW 2023-May-24: Testing
// Perform Script [ “Minimum Calls - YBCA NEW FOR BH 03192022” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
End If
Exit Loop If [ $error ]
# 
# @history 08/07/2024, chris.corsi@proofgeist.com -- @TODO - BA UP Meal may belong before min calls
// If [ Get ( AccountName ) ≠ "klee" ]
#  Before/After Unpaid Meal
If [ Length ( GLO_TCD_CTR__Contract::hrs_before_unpaid_meal ) 	or Length ( GLO_TCD_CTR__Contract::hrs_after_unpaid_meal ) ]
Perform Script [ “Before/After Unpaid Meal” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
Exit Loop If [ $error ]
End If
// End If
# 
# 
#  Midnight Split - amy minimums just created might span midnight, so we run this script again.
Perform Script [ “Midnight Split” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
Exit Loop If [ $error ]
# 
#  Night Rate
If [ Length ( GLO_TCD_CTR__Contract::mult_night ) 	and Length ( GLO_TCD_CTR__Contract::time_night_start ) 	and Length ( GLO_TCD_CTR__Contract::time_night_end ) ]
Perform Script [ “Night Rate” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
Exit Loop If [ $error ]
End If
# 
#  Daily Overtime
If [ ( 	Length ( GLO_TCD_CTR__Contract::hrs_overtime_daily_L1 ) 		and 	Length ( GLO_TCD_CTR__Contract::mult_overtime_daily_L1 ) ) 	or ( 	Length ( GLO_TCD_CTR__Contract::hrs_overtime_daily_L2 ) 		and 	Length ( GLO_TCD_CTR__Contract::mult_overtime_daily_L2 ) ) ]
Perform Script [ “Daily Overtime” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
Exit Loop If [ $error ]
End If
# 
#  Weekly Overtime
If [ Length ( GLO_TCD_CTR__Contract::hrs_overtime_weekly ) 	and Length ( GLO_TCD_CTR__Contract::mult_overtime_weekly ) 	and not IsEmpty ( GLO_TCD_CTR__Contract::start_of_week ) ]
Perform Script [ “Weekly Overtime” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
Exit Loop If [ $error ]
End If
# 
#  Consecutive Days
If [ ValueCount ( FilterValues ( "Consecutive Days"; $contract_rule_names )) ]
Perform Script [ “Consecutive Days - BH” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
Exit Loop If [ $error ]
End If
# 
#  Day of Week
If [ ValueCount ( FilterValues ( $contract_rule_names ; "Day of Week" )) ]
Perform Script [ “Day of Week” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
Exit Loop If [ $error ]
End If
# 
#  6th & 7th Day Overtime
// If [ ( 	not IsEmpty ( GLO_TCD_CTR__Contract::hrs_6th_day ) 		and 	not IsEmpty ( GLO_TCD_CTR__Contract::mult_6th_day ) ) 	or ( 	not IsEmpty ( GLO_TCD_CTR__Contract::hrs_7th_day ) 		and 	not IsEmpty ( GLO_TCD_CTR__Contract::mult_7th_day ) ) ]
// Perform Script [ “7th Day Overtime” ; Specified: From list ; Parameter:    ]
// Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
// Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
// Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
// Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
// Exit Loop If [ $error ]
// End If
# 
#  Housekeeping
// Perform Script [ “Housekeeping - ICCLOS” ; Specified: From list ; Parameter:    ]
// Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
// Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
// Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
// Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
// Exit Loop If [ $error ]
# 
#  End of inner Mode loop
Exit Loop If [ True ]
End Loop
# 
#  End of $mode_count loop
End Loop
# 
#  Write all of the new values back to the Time Card Line table.
Perform Script [ “Write to Disk - BH” ; Specified: From list ; Parameter: "mode=" & CF_addPSlashes ( $mode ) ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Set Variable [ $tcl_ids ; Value: CF_getProperty ( $scriptResult; "tcl_ids" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
# 
#  Exit the Inner Time Card loop.
Exit Loop If [ True ]
End Loop
# 
#  Clear the global variables used in the rule processing.
Set Variable [ $null ; Value: CF_ClearRepeatingVariable ( "$$unwork"; 1; $$unwork_count ) ]
Set Variable [ $$unwork_count ; Value: "" ]
# 
#  Clear each of the possible Mode variables: $$bill, $$pay, $$bill_count, $$pay_count
Set Variable [ $mode_count ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $mode_count = $mode_count + 1; $mode_count > ValueCount ( $mode )) ]
Set Variable [ $this_mode ; Value: GetValue ( $mode; $mode_count ) ]
Set Variable [ $null ; Value: CF_ClearRepeatingVariable ( "$$" & $this_mode; 1; Evaluate ( "$$" & $this_mode & "_count" )) ]
Set Variable [ $null ; Value: CF_ClearRepeatingVariable ( "$$" & $this_mode & "_count"; 1; 1 ) ]
End Loop
# 
#  If the $mode_loop or the "Write to Disk" script encountered any errors...
If [ $error > 0 ]
# 
#  Delete any related Bill or Pay records that might exist.
Set Variable [ $tcl_delete_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~tcl_id	= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~parent	= SQLField ( TCL__TimeCardLine::_timecardline_id ); 	~query	= "SELECT " & ~tcl_id & … ]
Exit Loop If [ CF_SQLErrorCheck ( "$tcl_delete_ids" ) ]
# 
#  If there are any extra IDs...
If [ not IsEmpty ( $tcl_delete_ids ) ]
# 
#  Cleanup on aisles 'bill' and 'pay'.
Perform Script [ “Delete Record PSOS” ; Specified: From list ; Parameter: List ( 	"id="	& CF_addPSlashes ( $tcl_delete_ids ); 	"TO="	& GetFieldName ( TCL__TimeCardLine::__id ) ) ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
// Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: List ( 	$message; 	CF_getProperty ( $scriptResult; "message" ) ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
# 
#  Update the Time Card with any Error messages
Set Field [ GLO_TCD__TimeCard::rulesRun_ts ; Get ( CurrentTimestamp ) ]
Set Field [ GLO_TCD__TimeCard::rulesError ; $message ]
Commit Records/Requests [ With dialog: Off ]
# 
End If
Else
#  Clear the OutOfWhack flags
Perform Script [ “Clear OutOfWhack flags” ; Specified: From list ; Parameter:    ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & CF_getProperty ( $scriptResult; "scriptName" ) & ¶ ) ]
# 
#  If we successfully cleared the flags...
If [ $error ]
Set Field [ GLO_TCD__TimeCard::rulesError ; $message ]
Else
#  Update the rule_run Timestamp
Set Field [ GLO_TCD__TimeCard::rulesRun_ts ; Get ( CurrentTimestamp ) ]
Set Field [ GLO_TCD__TimeCard::rulesError ; "" ]
# 
#  Add the current Time Card ID to a list of successfully processed IDs - to be returned to the parent script.
Set Variable [ $success_ids ; Value: List ( $success_ids; $$timecard_id ) ]
End If
End If
# 
#  Reset for the next (possible) Time Card
Set Variable [ $message_list ; Value: List ( 	$message_list; 	$message ) ]
Set Variable [ $error ; Value: 0 ]
Set Variable [ $message ; Value: "" ]
# 
#  End of $tcd_count loop
End Loop
# 
Exit Loop If [ True		//  Always exit the single-iteration control loop to prevent infinite spin!  ]
End Loop
# 
#  Cleanup steps: close worker windows, gather script results, etc...
Set Variable [ $error ; Value: If ( not IsEmpty ( $message_list ); 	True; 	$error ) ]
Set Variable [ $result ; Value: List ( 	"error="			& $error; 	"message="		& CF_addPSlashes ( List ( $message_list; $message )); 	"success_ids="	& CF_addPSlashes ( $success_ids ); ) ]
Go to Layout [ $originalLayout ; Animation: None ]
# 
#  Cleanup global variables
Set Variable [ $$bill_scope ; Value: "" ]
Set Variable [ $$company_id ; Value: "" ]
Set Variable [ $$contact_id ; Value: "" ]
Set Variable [ $$contract_rules ; Value: "" ]
Set Variable [ $$contract_rule_names ; Value: "" ]
Set Variable [ $$end_ts ; Value: "" ]
Set Variable [ $$event_id ; Value: "" ]
Set Variable [ $$start_ts ; Value: "" ]
Set Variable [ $$this_mode ; Value: "" ]
Set Variable [ $$timecard_id ; Value: "" ]
Set Variable [ $$vendor_id ; Value: "" ]
# 
#  Record a log entry
Perform Script [ “Create Log Entry” ; Specified: From list ; Parameter: List ( 	"action="		& "Apply Rules"; 	"file_name="		& Get ( FileName ); 	"script_name="	& Get ( ScriptName ); 	"run_time="		& ( Get ( CurrentTimeUTCMilliseconds ) - $startTime ) / 1000; 	"error="			& If ( IsEmpty ( $error ); 0; $error ); 	"parameters="	& CF_addPSlashes ( Get ( ScriptParameter )); 	"results="		& CF_addPSlashes ( $result ); 	"notes="			& CF_addPSlashes ( CF_Trim4 ( $process_log )); ) ]
# 
#  Restore the error capture and user abort states.
If [ not $errorCaptureOn ]
Set Error Capture [ Off ]
End If
If [ $userAbortOn ]
Allow User Abort [ On ]
End If
# 
#  That's it - exit script!
Exit Script [ Text Result: $result		//  We always return the result variable  ]
# 

```
