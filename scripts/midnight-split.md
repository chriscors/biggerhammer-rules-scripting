# Midnight Split

> Splits any TCL spanning midnight into two separate entries

## Script Text

```
# #
#  Time Card Lines that start before midnight, and end after, should be split at midnight.  Doing so will significantly simplify other rule scripts.
#  As a Modular script, several assumtions have been made.
#  As a PSOS script, we want to avoid opening windows, and ALL user interactions..
# 
# @history
#  12/22/2016 - Marc Berning - Initial Version
# 
# @assumptions
#  Context: We are already oriented to a Globals-based layout.
#  Environment: Allow User Abort & Error Capture states are appropriately set.
#  Environment: Parameters being passed in have already been validated.
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# 
# 
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Preheat variables here
Set Variable [ $record_count ; Value: Evaluate ( "$$" & $$this_mode & "_count" ) ]
Set Variable [ $midnight ; Value: CF_TimeFormat ( Time ( 0;0;0 )) ]
# 
#  Loop through the Time Card Lines
Set Variable [ $i ; Value: 0 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i + 1; $i > $record_count ) ]
# 
#  Break a few "field" values out into dedicated varaibles.  This will make reading/writing this script much easier, and reduce custom function calls.
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$i]" ) ]
Set Variable [ $this_date ; Value: GetAsDate ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::date ))) ]
Set Variable [ $this_time_in ; Value: GetAsTime ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_in ))) ]
Set Variable [ $this_time_out ; Value: GetAsTime ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out ))) ]
# 
#  If we find a record whose end time is "earlier" than its start time
If [ $this_time_in > $this_time_out 	and $this_time_out ≠ Time ( 0; 0; 0 ) ]
# 
#  Duplicate the current "record".
Perform Script [ “Duplicate Rule Variable” ; Specified: From list ; Parameter: List ( 	"mode="		& $$this_mode; 	"source="	& $i; ) ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Exit Loop If [ $error ]
# 
#  Change the current record's out time to midnight.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out ); $midnight ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $this_date + 1; $midnight )) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isAfterMidnight ); False ) ]
# 
#  Commit the changes back to the master global variable.
Set Variable [ $null ; Value: CF_SetVarByName ( "$$" & $$this_mode; $i; $this_record ) ]
# 
#  Move to the "new record"
Set Variable [ $i ; Value: $i + 1 ]
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$i]" ) ]
# 
#  Clear the Grace Period note form the "first" record.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::noteGracePeriod ); "" ) ]
# 
#  Set the new record to start at midnight, end at the original time, and isAfterMidnight.
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in ); $midnight ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( $this_date + 1; $midnight )) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $this_date + 1; $this_time_out )) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isAfterMidnight ); True ) ]
# 
#  Commit the changes back to the master global variable.
Set Variable [ $null ; Value: Let ( 	~var = "$$" & $$this_mode; 	CF_SetVarByName ( ~var; $i; $this_record ) ) ]
# 
#  There should never be more than 1 record changed.  Having found 1, we can safely exit.
Exit Loop If [ True ]
# 
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
