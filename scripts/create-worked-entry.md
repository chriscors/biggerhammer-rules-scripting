# Create Worked Entry

> Creates a new worked-time entry in the $$bill/$$pay array via Duplicate Rule Variable

## Script Text

```
# #Create worked entry 
#  Creates a global variable repetition containing the data of a rule variable, modified to be a Minimum Call record.
# 
# @history
#  06/08/2017 - Marc Berning - Initial Version
#  06/09/2017 - Marc Berning - Disabled the setting of several fields, so that the Minimum Call record preserves the status of the TCL that initiated its creation.
#  05/07/2018 - Marc Berning - Renamed script.  Added isMinimumcall parameter.  Enhanced isAfterMidnight calculation.
#  05/23/2018 - Marc Berning - Added support for isFlat field.
# 
# @assumptions
#  Environment: Allow User Abort & Error Capture states are appropriately set.
#  Environment: The parameters have already been adequately validated.
# 
# @param num $iSource (req): The variable repetition number that will serve as the source record.
# @param time $time_in (req):
# @param time $time_out (req):
# @param bool $isMinimumCall (opt): defaults to True
# @param bool $incl_NT (opt): Include Minimum Call records when calculating Night Rate
# @param bool $incl_OT (opt): Include Minimum Call records when calculating Overtime
# @param bool $last_rec (opt): True if this is to be the last record on the current time card.
# @param text $note (opt): The text for the Note field. 
# 
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Parse out script parameters here.
Set Variable [ $scriptParams ; Value: Get ( ScriptParameter ) ]
Set Variable [ $iSource ; Value: GetAsNumber ( CF_getProperty ( $scriptParams; "iSource" )) ]
Set Variable [ $time_in ; Value: Let ( 	~t = CF_getProperty ( $scriptParams; "time_in" ); 	If ( IsEmpty ( ~t ); ""; GetAsTime ( ~t )) ) ]
Set Variable [ $time_out ; Value: Let ( 	~t = CF_getProperty ( $scriptParams; "time_out" ); 	If ( IsEmpty ( ~t ); ""; GetAsTime ( ~t )) ) ]
Set Variable [ $isMinimumCall ; Value: Let ( 	~m = CF_getProperty ( $scriptParams; "isMinimumCall" ); 	If ( IsEmpty ( ~m ); True; GetAsBoolean ( ~m )) ) ]
Set Variable [ $incl_NT ; Value: GetAsBoolean ( CF_getProperty ( $scriptParams; "incl_NT" )) ]
Set Variable [ $incl_OT ; Value: GetAsBoolean ( CF_getProperty ( $scriptParams; "incl_OT" )) ]
Set Variable [ $last_rec ; Value: GetAsBoolean ( CF_getProperty ( $scriptParams; "last_rec" )) ]
Set Variable [ $note ; Value: Let ( 	~n = CF_getProperty ( $scriptParams; "note" ); 	If ( IsEmpty ( ~n ); "Minimum Call Applied"; ~n ) ) ]
If [ Get ( LastError ) ]
Set Variable [ $error ; Value: Get ( LastError ) ]
Set Variable [ $message ; Value: "Could not process script's parameters, possibly due to missing Custom Functions." ]
Exit Loop If [ True ]
End If
# 
#  Duplicate the current "record".
Perform Script [ “Duplicate Rule Variable” ; Specified: From list ; Parameter: List ( 	"mode="		& $$this_mode; 	"source="	& $iSource; ) ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Exit Loop If [ $error ]
# 
#  Load the "new record" into a variable
Set Variable [ $i ; Value: $iSource + $last_rec ]
Set Variable [ $this_record ; Value: Evaluate ( "$$" & $$this_mode & "[$i]" ) ]
Set Variable [ $this_date ; Value: GetAsDate ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::date ))) ]
Set Variable [ $isAfterMidnight ; Value: Case ( 	GetAsDate ( CF_getProperty ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ))) > $this_date; 		True; 	IsEmpty ( $time_in ); 		False; 	$time_in = Time ( 0; 0; 0 ); 		True; 	False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isAfterMidnight ); $isAfterMidnight ) ]
Set Variable [ $ts_date ; Value: $this_date + $isAfterMidnight ]
# 
#  Set a few fields
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMinimumCall ); $isMinimumCall ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in ); $time_in ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out ); $time_out ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_in_ts_c ); Timestamp ( $ts_date; $time_in )) ]
// Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( $ts_date; $time_out )) ]
Set Variable [ $this_record ; Value: Let ( 	~date = If ( not $isAfterMidnight and $time_out < $time_in; 		$ts_date + 1; 		$ts_date 	); 	CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::time_out_ts_c ); Timestamp ( ~date; $time_out )) ) /* If the new line doesn't start after mid… ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::noteRule ); $note ) ]
# 
#  Clear a few fields
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::noteGracePeriod ); "" ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::hrsUnworked ); "" ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isFlat ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMP2 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOutOfWhack ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isPaidMeal ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isUnpaidMeal ); False ) ]
# 
#  If the Contract indicates that Minimum Call can NOT be paid at OT...
If [ not $incl_OT ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL1 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTDailyL2 ); False ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isOTWeekly ); False ) ]
End If
# 
#  If the Contract indicates that Minimum Call CAN be paid at Night Rate...
If [ $incl_NT ]
#  If the Minimum Call began at midnight, the prevailing rate is NOT Night Rate
If [ $time_in = Time ( 0; 0; 0 ) ]
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); False ) ]
End If
Else
Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isNightRate ); False ) ]
End If
# 
#  A couple modifiers that aren't being used at this time.
// Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isMisc1 ); False ) ]
// Set Variable [ $this_record ; Value: CF_setPropertyValue ( $this_record; GFN ( TCL__TimeCardLine::isRecording ); False ) ]
# 
#  Preserve the changes made to $this_record.
Set Variable [ $null ; Value: Let ( 	~var = "$$" & $$this_mode; 	CF_SetVarByName ( ~var; $i; $this_record ) ) ]
# 
Exit Loop If [ True		//  Always exit the single-iteration control loop to prevent infinite spin!  ]
End Loop
# 
#  That's it - exit script!
Exit Script [ Text Result: True		//  We always return something  ]
# 

```
