# Create History Variables

> Loads $history[n] with TCL data from prior time cards for cross-TCD tracking

## Script Text

```
# #
#  Creates a set of global variables containing the data of all the related Time Card Line records.
#     These variables will be used by the rule scripts, instead of direct record access, to improve speed & reduce record lock contention.
#     The fields to be included are specified by the $match_fields parameter.
# 
# @history
#  11/30/2016 - Marc Berning - Initial Version
#  12/27/2016 - Marc Berning - History variable sort order set by parameter
#  06/12/2017 - Marc Berning - Added $include_Minimum_Calls parameter
#  06/13/2017 - Marc Berning - Added $ids_only parameter and $matching_ids return property.
#  09/10/2020 - Marc Berning - Added support for "Payable Calculation Scope" contract rule.
# 
# @assumptions
#  Environment: Allow User Abort & Error Capture states are appropriately set.
#  Environment: The parameters have already been adequately validated.
# 
# @param date $start_date (req): the earliest date to be used in the search criteria.
# @param ts   $end_ts (req): the latest OUT timestamp of the current Time Card.
# @param text $match_fields (opt): List of fields to include in the results.
# @param enum $sort (opt): $$history repeating variable sort order.  One of: ASC, DESC.  Defaults to DESC
# @param bool $include_Minimum_Calls (opt): If True, Minimum Call records will be included in the results.  Defaults to False
# @param bool $ids_only (opt): If True, only a list of TCL IDs is returned.
# @param enum $pay_scope (opt): When looking for payable records, optionally limit scope to one of: Vendor, none.  Default: Vendor
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# @return text $matching_ids (cond): If $ids_only = True, a delimited list of matching TCL IDs.
# 
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Parse out script parameters here.
Set Variable [ $scriptParams ; Value: Get ( ScriptParameter ) ]
Set Variable [ $start_date ; Value: GetAsDate ( CF_getProperty ( $scriptParams; "start_date" )) ]
Set Variable [ $end_ts ; Value: GetAsTimestamp ( CF_getProperty ( $scriptParams; "end_ts" )) ]
Set Variable [ $match_fields ; Value: CF_getProperty ( $scriptParams; "match_fields" ) ]
Set Variable [ $sort ; Value: Let ( 	~s = CF_getProperty ( $scriptParams; "sort" ); 	If ( IsEmpty ( ~s ); "DESC"; ~s ) ) ]
Set Variable [ $include_Minimum_Calls ; Value: Let ( 	~mc = CF_getProperty ( $scriptParams; "include_Minimum_Calls" ); 	If ( IsEmpty ( ~mc ); False; GetAsBoolean (~mc )) ) ]
Set Variable [ $ids_only ; Value: Let ( 	~ido = CF_getProperty ( $scriptParams; "ids_only" ); 	If ( IsEmpty ( ~ido ); False; GetAsBoolean ( ~ido )) ) ]
Set Variable [ $pay_scope ; Value: Let ( 	~x = CF_getProperty ( $scriptParams; "pay_scope" ); 	If ( IsEmpty ( ~x ); "Vendor"; ~x ) ) ]
# 
Set Variable [ $excludeEstimates ; Value: $$this_mode = "Pay" 	and ValueCount ( FilterValues ( Substitute ( CF_GetArrayColumn ( $$contract_rules; 1; "∞" ); "name="; "" ); "Payable Calculation Scope" )) ]
# 
#  Isolate the target Time Card IDs from the clock records.  We always exclude Unpaid Meals.
If [ $$this_mode = "bill" ]
#  For Billable values, we need to include the Event ID.
If [ $include_Minimum_Calls ]
If [ $$bill_scope = "Event" ]
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~eve_id	= SQLField ( TCL__TimeCardLine:… ]
Else If [ $$bill_scope = "Client" ]
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~com_id	= SQLField ( TCL__TimeCardLine::_company_id ); 	~con_id	= SQLField ( TCL__TimeCardLine:… ]
Else If [ $$bill_scope = "Employer" ]
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~vnd_id	= SQLField ( TCL__TimeCardLine:… ]
End If
Else
If [ $$bill_scope = "Event" ]
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~eve_id	= SQLField ( TCL__TimeCardLine:… ]
Else If [ $$bill_scope = "Client" ]
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~com_id	= SQLField ( TCL__TimeCardLine::_company_id ); 	~con_id	= SQLField ( TCL__TimeCardLine:… ]
Else If [ $$bill_scope = "Employer" ]
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~vnd_id	= SQLField ( TCL__TimeCardLine:… ]
End If
End If
Else
#  USUALLY, for Payable values, we need to include the vendor ID.
If [ $pay_scope = "Vendor" ]
If [ $include_Minimum_Calls ]
If [ $$excludeEstimatesFromPayable ]
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~eve_id	= SQLField ( TCL__TimeCardLine::_event_id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_… ]
Else
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~ven_id	= SQLField ( TCL__TimeCardLine:… ]
End If
Else
If [ $$excludeEstimatesFromPayable ]
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~eve_id	= SQLField ( TCL__TimeCardLine::_event_id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_… ]
Else
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~ven_id	= SQLField ( TCL__TimeCardLine:… ]
End If
End If
Else
If [ $include_Minimum_Calls ]
If [ $$excludeEstimatesFromPayable ]
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~eve_id	= SQLField ( TCL__TimeCardLine::_event_id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_… ]
Else
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~date	= SQLField ( TCL__TimeCardLine::d… ]
End If
Else
If [ $$excludeEstimatesFromPayable ]
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~eve_id	= SQLField ( TCL__TimeCardLine::_event_id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_… ]
Else
Set Variable [ $tcd_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~date	= SQLField ( TCL__TimeCardLine::d… ]
End If
End If
End If
End If
# 
#  Evaluate the results
Exit Loop If [ CF_SQLErrorCheck ( "$tcd_ids" ) ]
Exit Loop If [ IsEmpty ( $tcd_ids ) ]
# 
#  Isolate the target Time Card and Time Card Line IDs from the bill or pay records.  We always exclude Unpaid Meals.
If [ $$this_mode = "bill" ]
#  For Billable values, we need to include the Event ID.
If [ $include_Minimum_Calls ]
If [ $$bill_scope = "Event" ]
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~eve_id	= SQLField ( TCL__TimeCardLine:… ]
Else If [ $$bill_scope = "Client" ]
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~com_id	= SQLField ( TCL__TimeCardLine::_company_id ); 	~con_id	= SQLField ( TCL__TimeCardLine:… ]
Else If [ $$bill_scope = "Employer" ]
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~vnd_id	= SQLField ( TCL__TimeCardLine:… ]
End If
Else
If [ $$bill_scope = "Event" ]
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~eve_id	= SQLField ( TCL__TimeCardLine:… ]
Else If [ $$bill_scope = "Client" ]
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~com_id	= SQLField ( TCL__TimeCardLine:… ]
Else If [ $$bill_scope = "Employer" ]
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~vnd_id	= SQLField ( TCL__TimeCardLine:… ]
End If
End If
Else
#  USUALLY, for Payable values, we need to include the vendor ID.
If [ $pay_scope = "Vendor" ]
If [ $include_Minimum_Calls ]
If [ $$excludeEstimatesFromPayable ]
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~eve_id	= SQLField ( TCL__TimeCardLine::_event_id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_t… ]
Else
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~ven_id	= SQLField ( TCL__TimeCardLine:… ]
End If
Else
If [ $$excludeEstimatesFromPayable ]
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~eve_id	= SQLField ( TCL__TimeCardLine::_event_id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_t… ]
Else
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~ven_id	= SQLField ( TCL__TimeCardLine:… ]
End If
End If
Else
If [ $include_Minimum_Calls ]
If [ $$excludeEstimatesFromPayable ]
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~eve_id	= SQLField ( TCL__TimeCardLine::_event_id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_t… ]
Else
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~date	= SQLField ( TCL__TimeCardLine::d… ]
End If
Else
If [ $$excludeEstimatesFromPayable ]
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~eve_id	= SQLField ( TCL__TimeCardLine::_event_id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_t… ]
Else
Set Variable [ $tcl_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~date	= SQLField ( TCL__TimeCardLine::d… ]
End If
End If
End If
End If
# 
#  Evaluate the results
Exit Loop If [ CF_SQLErrorCheck ( "$tcl_ids" ) ]
# 
#  The Time Card Line IDs to be included in the history:
Set Variable [ $bill_pay_ids ; Value: CF_GetArrayColumn ( $tcl_ids; 2; "," ) ]
# 
#  The Time Card IDs that don't have related Time Card Line records:
Set Variable [ $tcd_remaining ; Value: CF_XORValues ( CF_GetArrayColumn ( $tcd_ids; 1; "," ); CF_GetArrayColumn ( $tcl_ids; 1; "," )) ]
# 
#  If there are any remaining...
If [ Length ( $tcd_remaining ) ]
# 
#  Assemble a list of the clock IDs to be included in the history by looping through the $clock_ids
Set Variable [ $i ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i + 1; $i > ValueCount ( $tcd_ids )) ]
# 
#  If the next value matches the ID from the $tcd_remaining list...
If [ ValueCount ( FilterValues ( CF_GetArrayItem ( $tcd_ids; $i; 1; "," ); $tcd_remaining )) ]
Set Variable [ $clock_ids ; Value: List ( $clock_ids; CF_GetArrayItem ( $tcd_ids; $i; 2; "," )) ]
End If
End Loop
End If
# 
#  At last, we know which TCL IDs to include in the history variables.
Set Variable [ $matching_ids ; Value: List ( $clock_ids; $bill_pay_ids ) ]
# 
#  If we have been asked to return only the IDs, we can exit early.
If [ $ids_only ]
# 
#  We need to put the list of matching_ids into proper chronological order.
Set Variable [ $matching_ids ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~in_ts	= SQLField ( TCL__TimeCardLine::time_in_ts_c ); 	~id_list	= SQLList ( $matching_ids; True ); 	~query	= "SELECT " & ~id & 				" FROM " & ~table & … ]
Exit Loop If [ CF_SQLErrorCheck ( "$matching_ids" ) ]
Exit Loop If [ True ]
End If
# 
#  Next use ExecuteSQL to assemble the necessary field data
Set Variable [ $raw_data ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~id		= SQLField ( TCL__TimeCardLine::__id ); 	~in_ts	= SQLField ( TCL__TimeCardLine::time_in_ts_c ); 	~id_list	= SQLList ( $matching_ids; True ); 	~query	= "SELECT *" & 				" FROM " & ~table & 				"… ]
Exit Loop If [ CF_SQLErrorCheck ( "$raw_data" ) ]
Set Variable [ $record_count ; Value: ValueCount ( $raw_data ) ]
# 
#  Use ExecuteSQL to collect the field names
Set Variable [ $name_data ; Value: Let ([ 	~table	= Substitute ( SQLTable ( TCL__TimeCardLine::__id ); "\""; "'" ); 	~query	= "SELECT FieldName, FieldType FROM FileMaker_Fields WHERE TableName = " & ~table ]; 	ExecuteSQL ( ~query; "∞" ; "" ) ) ]
Exit Loop If [ CF_SQLErrorCheck ( "$name_data" ) ]
Set Variable [ $field_count ; Value: ValueCount ( $name_data ) ]
# 
#  Loop through each record
Set Variable [ $i ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i + 1; $i > $record_count ) ]
Set Variable [ $next_record ; Value: Substitute ( GetValue ( $raw_data; $i ); "∞"; ¶ ) ]
# 
#  Loop through each field name, creating name-value pairs
Set Variable [ $j ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $j = $j + 1; $j > $field_count ) ]
Set Variable [ $next_name_type ; Value: Substitute ( GetValue ( $name_data; $j ); "∞"; ¶ ) ]
Set Variable [ $next_name ; Value: GetValue ( $next_name_type; 1 ) ]
# 
#  Only add the property if the field is on our match_field list.
If [ ValueCount ( FilterValues ( $next_name; $match_fields )) ]
Set Variable [ $next_type ; Value: GetValue ( $next_name_type; 2 ) ]
Set Variable [ $next_value ; Value: Case ( 	$next_type = "date"; 		CF_DateFromUnix ( GetValue ( $next_record; $j )); 	$next_type = "timestamp"; 		CF_TsFromUnix ( GetValue ( $next_record; $j )); 	GetValue ( $next_record; $j ) ) ]
Set Variable [ $null ; Value: Let ([ 	~var = "$$history"; 	~rep = ~var & "[$i]" ]; 	CF_SetVarByName ( ~var; $i; List ( Evaluate ( ~rep ); $next_name & "=" & CF_addPSlashes ( $next_value ))) ) ]
End If
End Loop
End Loop
# 
Exit Loop If [ True		//  Always exit the single-iteration control loop to prevent infinite spin!  ]
End Loop
# 
#  Cleanup steps: close worker windows, gather script results, etc...
Set Variable [ $result ; Value: List	( 	"error="			& If ( IsEmpty ( $error ); 0; $error ); 	"message="		& CF_addPSlashes ( $message ); 	"count="			& If ( $ids_only; ValueCount ( $matching_ids ); $record_count ); 	"matching_ids="	& If ( $ids_only; CF_addPSlashes ( $matching_ids ); "" );… ]
# 
#  That's it - exit script!
Exit Script [ Text Result: $result		//  We always return the result variable  ]
# 

```
