# Create Rule Variables

> Loads Clock TCLs into repeating global variables ($$bill[n] / $$pay[n])

## Script Text

```
# #
#  Creates a set of global variables containing the data of all the related Time Card Line records.
#     These variables will be used by the rule scripts, instead of direct record access, to improve speed & reduce record lock contention.
# 
# @history
#  11/30/2016 - Marc Berning - Initial Version
#  06/10/2016 - Marc Berning - Updated the fields in the $omit_fields list
#  07/15/2018 - Marc Berning - Added omit_unpd parameter
# 
# @assumptions
#  Environment: Allow User Abort & Error Capture states are appropriately set.
#  Environment: The parameters have already been adequately validated.
# 
# @param bool $omit_unpd (opt): If True, Unpaid Meals are omitted from the Billable & Payable record set. Default is False
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# @return num $count (req): Number of records found, a.k.a. the number of $$variable repetitions.
# 
# 
#  Preheat variables here
// Set Variable [ $startTime ; Value: Get ( CurrentTimeUTCMilliseconds ) ]
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Parse out script parameters here.
Set Variable [ $scriptParams ; Value: Get ( ScriptParameter ) ]
Set Variable [ $omit_unpd ; Value: Let ( 	~o = CF_getProperty ( $scriptParams; "omit_unpd" ); 	If ( IsEmpty ( ~o ); False; GetAsBoolean ( ~o )) ) ]
# 
#  A list of fields that do not need to be included, such as calculations, summaries and globals.
Set Variable [ $omit_fields ; Value: List ( 	GFN ( TCL__TimeCardLine::__id ); 	GFN ( TCL__TimeCardLine::__id_listof ); 	GFN ( TCL__TimeCardLine::_contractRate_id ); 	GFN ( TCL__TimeCardLine::_department_id ); 	GFN ( TCL__TimeCardLine::_employeeRating_id ); 	GFN ( TCL__TimeCardLine::_one_g )… ]
# 
#  Use ExecuteSQL to first collect the field names and field types
Set Variable [ $name_data ; Value: Let ([ 	~table	= Substitute ( SQLTable ( TCL__TimeCardLine::__id ); "\""; "'" ); 	~query	= "SELECT FieldName, FieldType FROM FileMaker_Fields WHERE TableName = " & ~table ]; 	ExecuteSQL ( ~query; "∞" ; "" ) ) ]
Exit Loop If [ CF_SQLErrorCheck ( "$name_data" ) ]
Set Variable [ $field_count ; Value: ValueCount ( $name_data ) ]
# 
#  The Client Preferences may ask us to omit Umpaid Meals from the process.
If [ $omit_unpd ]
#  Use ExecuteSQL to assemble the necessary field data without Unpaid Meals
Set Variable [ $raw_data ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~is_bill	= SQLField ( TCL__TimeCardLine::isBill ); 	~is_pay	= SQLField ( TCL__TimeCardLine::isPay ); 	~in_ts	= SQLField ( TCL__TimeCardLine::… ]
// Set Variable [ $raw_data ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~is_bill	= SQLField ( TCL__TimeCardLine::isBill ); 	~is_pay	= SQLField ( TCL__TimeCardLine::isPay ); 	~in_ts	= SQLField ( TCL__TimeCardLine::… ]
Else
#  Use ExecuteSQL to assemble the necessary field data
Set Variable [ $raw_data ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~in_ts	= SQLField ( TCL__TimeCardLine::time_in_ts_c ); 	~is_bill	= SQLField ( TCL__TimeCardLine::isBill ); 	~is_pay	= SQLField ( TCL__TimeCar… ]
// Set Variable [ $raw_data ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~in_ts	= SQLField ( TCL__TimeCardLine::time_in_ts_c ); 	~is_bill	= SQLField ( TCL__TimeCardLine::isBill ); 	~is_pay	= SQLField ( TCL__TimeCar… ]
End If
Exit Loop If [ CF_SQLErrorCheck ( "$raw_data" ) ]
Set Variable [ $record_count ; Value: ValueCount ( $raw_data ) ]
# 
#  Clear each of the Mode variables: $$bill, $$pay, $$bill_count, $$pay_count
Set Variable [ $null ; Value: CF_ClearRepeatingVariable ( "$$" & $$this_mode; 1; Min ( 1; Evaluate ( "$$" & $$this_mode & "_count" ))) ]
Set Variable [ $null ; Value: CF_ClearRepeatingVariable ( "$$" & $$this_mode & "_count"; 1; 1 ) ]
# 
#  Loop through each record
Set Variable [ $i ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i + 1; $i > $record_count ) ]
Set Variable [ $next_record ; Value: Substitute ( GetValue ( $raw_data; $i ); "∞"; ¶ ) ]
# 
#  Loop through each of the name & raw data, creating name-value pairs
Set Variable [ $j ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $j = $j + 1; $j > $field_count ) ]
Set Variable [ $next_name_type ; Value: Substitute ( GetValue ( $name_data; $j ); "∞"; ¶ ) ]
Set Variable [ $next_name ; Value: GetValue ( $next_name_type; 1 ) ]
If [ $next_name = GFN ( TCL__TimeCardLine::__id ) ]
Set Variable [ $this_id ; Value: GetValue ( $next_record; $j ) ]
End If
# 
#  Only add the property if the field is NOT on our omit list.
If [ not ValueCount ( FilterValues ( $next_name; $omit_fields )) ]
Set Variable [ $next_type ; Value: GetValue ( $next_name_type; 2 ) ]
Set Variable [ $next_value ; Value: Case ( 	$next_type = "date"; 		CF_DateFromUnix ( GetValue ( $next_record; $j )); 	$next_type = "timestamp"; 		CF_TsFromUnix ( GetValue ( $next_record; $j )); 	$next_type = "time"; 		GetAsTime ( GetValue ( $next_record; $j )); 	GetValue ( $next_record; $j… ]
If [ $$this_mode = "bill" ]
Insert Calculated Result [ Target: $$bill[$i] ; $next_name & "=" & CF_addPSlashes ( $next_value ) & ¶ ]
Else
Insert Calculated Result [ Target: $$pay[$i] ; $next_name & "=" & CF_addPSlashes ( $next_value ) & ¶ ]
End If
End If
# 
#  End of Field loop
End Loop
# 
#  Touch up (or add) a few name-value pairs
# 
#  _timecardline_id
Set Variable [ $null ; Value: Let ([ 	~var = "$$" & $$this_mode; 	~rep = ~var & "[$i]" ]; 	CF_SetVarByName ( ~var; $i; List ( Evaluate ( ~rep ); GFN ( TCL__TimeCardLine::_timecardline_id ) & "=" & $this_id )) ) ]
#  isBill
Set Variable [ $null ; Value: Let ([ 	~var = "$$" & $$this_mode; 	~rep = ~var & "[$i]" ]; 	CF_SetVarByName ( ~var; $i; List ( Evaluate ( ~rep ); GFN ( TCL__TimeCardLine::isBill ) & "=" & Case ( $$this_mode = "Bill"; True; False ))) ) ]
#  isPay
Set Variable [ $null ; Value: Let ([ 	~var = "$$" & $$this_mode; 	~rep = ~var & "[$i]" ]; 	CF_SetVarByName ( ~var; $i; List ( Evaluate ( ~rep ); GFN ( TCL__TimeCardLine::isPay ) & "=" & Case ( $$this_mode = "Pay"; True; False ))) ) ]
#  isOutOfWhack
Set Variable [ $null ; Value: Let ([ 	~var = "$$" & $$this_mode; 	~rep = ~var & "[$i]" ]; 	CF_SetVarByName ( ~var; $i; List ( Evaluate ( ~rep ); GFN ( TCL__TimeCardLine::isOutOfWhack ) & "=" & False )) ) ]
# 
#  End of Record loop
End Loop
# 
Exit Loop If [ True		//  Always exit the single-iteration control loop to prevent infinite spin!  ]
End Loop
# 
#  Cleanup steps: close worker windows, gather script results, etc...
Set Variable [ $result ; Value: List	( 	"error="			& If ( IsEmpty ( $error ); 0; $error ); 	"message="		& CF_addPSlashes ( $message ); 	"count="			& $record_count; 	"scriptName="	& Get ( ScriptName ) & " ( " & $$this_mode & " )"; ) ]
# 
#  That's it - exit script!
Exit Script [ Text Result: $result		//  We always return the result variable  ]
# 

```
