# Validate Time Card

> Checks for overlapping Clock TCL entries on the given date

## Script Text

```
# #
#  Verify that the current Time Card's employee has no overlapping Time Card Line entries on this day
# 
#  All Time Card Lines for this employee on this date are checked, regardless of Vendor or Event.
#  Only Minimum Call and UnPaid Meal records are excluded.
#  Validation is determined by ordering the records in chronological order, and comparing the out TS with the next IN ts.
# 
# @history
#  05/31/2017 - Marc Berning - Initial Version
#  12/26/2017 - Marc Berning - Added start_ts and end_ts parameters
# 
# @assumptions
#  Environment: Allow User Abort & Error Capture states are appropriately set.
# 
# @param text $contact_id (req): the unique ID of the contact to be examined
# @param date $date (req): the date under scrutiny,
# @param ts $start_ts (req): Earliest TS of all Time Card Line Clock records for the current Time Card
# @param ts $end_ts (req): Latest TS of all Time Card Line Clock records for the current Time Card
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# 
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Parse out script parameters here.
Set Variable [ $scriptParams ; Value: Get ( ScriptParameter ) ]
Set Variable [ $contact_id ; Value: CF_getProperty ( $scriptParams; "contact_id" ) ]
Set Variable [ $date ; Value: GetAsDate ( CF_getProperty ( $scriptParams; "date" )) ]
Set Variable [ $start_ts ; Value: GetAsTimestamp ( CF_getProperty ( $scriptParams; "start_ts" )) ]
Set Variable [ $end_ts ; Value: GetAsTimestamp ( CF_getProperty ( $scriptParams; "end_ts" )) ]
# 
#  Validate required parameters
If [ IsEmpty ( $contact_id ) ]
Set Variable [ $error ; Value: 1201 ]
Set Variable [ $message ; Value: List ( $message; "Missing required parameter: contact_id" ) ]
End If
If [ IsEmpty ( $date ) ]
Set Variable [ $error ; Value: 1201 ]
Set Variable [ $message ; Value: List ( $message; "Missing required parameter: date" ) ]
End If
If [ IsEmpty ( $start_ts ) ]
Set Variable [ $error ; Value: 1201 ]
Set Variable [ $message ; Value: List ( $message; "Missing required parameter: start_ts" ) ]
End If
If [ IsEmpty ( $end_ts ) ]
Set Variable [ $error ; Value: 1201 ]
Set Variable [ $message ; Value: List ( $message; "Missing required parameter: end_ts" ) ]
End If
Exit Loop If [ $error ]
# 
#  Contract value specifies if we our scope should be restircted to the Contact, or to the current Timecard
If [ Let ( 	~validate = If ( GetAsBoolean ( GLO_TCD_EVE__Event::isEstimate ); 		GLO_TCD_CTR__Contract::validate_continuity_estimate; 		GLO_TCD_CTR__Contract::validate_continuity_actual 	); 	~validate = "Timecard" ) ]
#  Assemble a list of in & out timestamps for the current Timecard
Set Variable [ $tcl_list ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~tcd_id	= SQLField ( TCL__TimeCardLine::_timecard_id ); 	~date	= SQLField ( TCL__TimeCardLine::date ); 	~is_bill	= SQLField ( TCL__TimeCardLine::isBill ); 	~is_pay	= SQLField ( TCL__TimeCardLine::is… ]
Else
#  Assemble a list of in & out timestamps for the current Contact
Set Variable [ $tcl_list ; Value: Let ([ 	~table	= SQLTable ( TCL__TimeCardLine::__id ); 	~con_id	= SQLField ( TCL__TimeCardLine::_contact_id ); 	~date	= SQLField ( TCL__TimeCardLine::date ); 	~is_bill	= SQLField ( TCL__TimeCardLine::isBill ); 	~is_pay	= SQLField ( TCL__TimeCardLine::isP… ]
End If
#  Evaluate the results
Exit Loop If [ CF_SQLErrorCheck ( "$tcl_list" ) ]
If [ IsEmpty ( $tcl_list ) ]
Exit Loop If [ Let ( $error = -1; True ) ]
Else If [ ValueCount ( $tcl_list ) = 1 ]
Exit Loop If [ True ]
End If
# 
#  Loop through the list
Set Variable [ $i ; Value: 1 ]
Set Variable [ $this_record ; Value: Substitute ( GetValue ( $tcl_list; $i ); ","; ¶ ) ]
Set Variable [ $last_out ; Value: GetAsTimestamp ( GetValue ( $this_record; 2 )) ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i + 1; $i > ValueCount ( $tcl_list )) ]
#  Break out the next set of values.
Set Variable [ $this_record ; Value: Substitute ( GetValue ( $tcl_list; $i ); ","; ¶ ) ]
Set Variable [ $this_in ; Value: GetAsTimestamp ( GetValue ( $this_record; 1 )) ]
#  Compare the current "record" with the previous.
If [ $this_in < $last_out ]
Set Variable [ $error ; Value: True ]
Set Variable [ $message ; Value: Let ([ 	full = GLO_TCD_CON__Contact::Name_Full_fl_c; 	first = GLO_TCD_CON__Contact::Name_First; 	first = If ( IsEmpty ( first ); "The"; CF_Trim4 ( first ) & "'s") ]; 	full & " has overlapping clock records.  " & first & " contract rules cannot be applied… ]
Exit Loop If [ True ]
End If
#  Prepare for the next iteration.
Set Variable [ $last_out ; Value: GetAsTimestamp ( GetValue ( $this_record; 2 )) ]
End Loop
# 
Exit Loop If [ True		//  Always exit the single-iteration control loop to prevent infinite spin!  ]
End Loop
# 
#  Cleanup steps: return to original layouts, gather script results, etc...
Set Variable [ $result ; Value: List	( 	"error="			& If ( IsEmpty ( $error ); 0; $error ); 	"message="		& CF_addPSlashes ( $message ); 	"scriptName="	& Get ( ScriptName ); ) ]
# 
#  That's it - exit script!
Exit Script [ Text Result: $result		//  We always return the result variable  ]
# 

```
