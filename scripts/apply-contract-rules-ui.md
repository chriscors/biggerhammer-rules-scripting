# Apply Contract Rules (UI Script)

> Phase 1 UI script — triggers rule processing from the Time Card layout

## Script Text

```
# #
#  UI script for Applying Contract Rules to Time Card(s).
#  Which rules to actually apply will be contract-based - some day.
# 
# @history
#  11/14/2016 - Marc Berning - Initial Version
#  04/14/2017 - Marc Berning - Changed default behavior - If no Time Cards are selected, only the current Time Card is processed.
#  04/20/2017 - Marc Berning - added reference to GLO__Globals::zRefresh_g field to induce updating of Time Card Line hour totals.
#  07/13/2018 - Marc Berning - added PSOS parameter
#  12/14/2018 - Marc Berning - added process timers
#  12/15/2018 - Marc Berning - Disabled BrowserNav while applying contract rules
#  12/18/2018 - Marc Berning - Save, then retore filter criteria after rules are applied.
#  05/25/2023 - Heather William - General cleanup and adding logic to skip Thermometer when CF_isDev is true
# 
# @param text $timeCard_id (opt): Return-delimited list of Time Card IDs.  If blank, this script will try to determine the IDs.
# @param enum $mode (opt): Apply rules for Billable values, Payable values, or both.  Defaults to 'both'  One of: "bill", "pay", "staff"
# @param bool $clear_selection (opt): If False, script will not clear the Time Card selections.  Parameter is passed ONLY from Apply Templates script.
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
Set Variable [ $original_selected ; Value: CLL__Call::__id_selected_g ]
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Verify current window mode
Exit Loop If [ Get ( WindowMode )		//  Browse mode = 0  ]
# 
#  Parse out script parameters here.
Set Variable [ $scriptParams ; Value: Get ( ScriptParameter ) ]
Set Variable [ $timeCard_id ; Value: CF_getProperty ( $scriptParams; "timeCard_id" ) ]
Set Variable [ $mode ; Value: Let ( 	~m = CF_getProperty ( $scriptParams; "mode" ); 	If ( IsEmpty ( ~m ); 		If ( GLO__Globals::apply_rules_on_Estimate_is_Limited_g and CLL_EVE__Event::isEstimate; 			"bill"; 			"bill¶pay" 		); 		~m 	) ) ]
Set Variable [ $clear_selection ; Value: Let ( 	~cs = CF_getProperty ( $scriptParams; "clear_selection" ); 	If ( IsEmpty ( ~cs ); ""; GetAsBoolean ( ~cs )) ) ]
If [ Get ( LastError ) ]
Set Variable [ $error ; Value: Get ( LastError ) ]
Set Variable [ $message ; Value: "Could not process script's parameters, possibly due to missing Custom Functions." ]
Exit Loop If [ True ]
End If
# 
#  Validate parameters
If [ $mode = "staff" ]
Set Variable [ $staff ; Value: " Staff" ]
Set Variable [ $mode ; Value: "pay" ]
End If
If [ Let ( 	~n = ValueCount ( FilterValues ( $mode; "bill¶pay" )); 	~n < 1 or ~n > 2 ) ]
Set Variable [ $message ; Value: "Invalid parameter: mode = " & $mode ]
Exit Loop If [ Let ( $error = True; True ) ]
End If
# 
#  Verify current context
If [ not CF_CheckLayoutTableName ( CLL__Call::__id ) 	and not CF_CheckLayoutTableName ( TCD__TimeCard::__id ) 	and not CF_CheckLayoutTableName ( VIL__VirtualList::__id ) ]
Set Variable [ $message ; Value: "Script not available from the current layout." ]
Exit Loop If [ Let ( $error = True; True ) ]
End If
# 
#  If not provided via parameter...
If [ IsEmpty ( $timeCard_id ) ]
#  process the current Time Card.
Set Variable [ $timeCard_id ; Value: Case ( 	CF_CheckLayoutTableName ( CLL__Call::__id ); 		CLL_TCD__TimeCard::_activeTCD_g; 	CF_CheckLayoutTableName ( TCD__TimeCard::__id ); 		TCD__TimeCard::__id; 	CF_CheckLayoutTableName ( VIL__VirtualList::__id ); 		VIL__VirtualList::column10 ) ]
End If
# 
#  Commit any unsaved changes
If [ Get ( RecordOpenCount ) ]
Commit Records/Requests [ With dialog: Off ]
If [ Get ( LastError ) ]
Set Variable [ $error ; Value: Get ( LastError ) ]
Set Variable [ $message ; Value: "Please save any changes and try again." ]
Exit Loop If [ True ]
End If
End If
# 
If [ not $$WebDirect 	and not CF_CheckLayoutTableName ( VIL__VirtualList::__id ) ]
#  Move to a layout more conducive to rule operations.
Set Variable [ $original_slider ; Value: Case ( 	GetLayoutObjectAttribute ( "slider.Clock"; "isFrontPanel" ); "slider.Clock"; 	GetLayoutObjectAttribute ( "slider.Bill"; "isFrontPanel" ); "slider.Bill"; 	GetLayoutObjectAttribute ( "slider.Pay"; "isFrontPanel" ); "slider.Pay"; 	GetLayoutObjectAtt… ]
#  Disable BrowserNav
Set Variable [ $$BrowserNav ; Value: JSONSetElement ( $$BrowserNav ; "disabled" ; True ; "" ) ]
Set Variable [ $$rule_navigation ; Value: True ]
Go to Layout [ “Call - Apply Rules” (CLL__Call) ; Animation: None ]
Go to Object [ Object Name: $original_slider ; Repetition: 1 ]
End If
# 
#  Calculate the number of records per trip
Set Variable [ $tcd_total ; Value: ValueCount ( $timeCard_id ) ]
Set Variable [ $tcd_limit ; Value: Min ( Ceiling ( $tcd_total / 5 ); 5 ) ]
# 
#  Update the inter-process timer
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & "Nav to 'Apply Rules' layout¶" ) ]
If [ not CF_isDevServer ]
#  Show a progress dialog.   Eventually we may programatically determine the number of records to process with each loop.
Perform Script [ “Thermometer” ; Specified: From list ; Parameter: Let ([ 	~n = $tcd_total; 	~q = "1" & If ( $tcd_limit > 1; " - " & $tcd_limit ); 	~s = If ( $tcd_limit > 1; "s "; " " ) ]; 	List ( 		"mode="			& "Show"; 		"title="			& "Applying Contract Rules ..."; 		"description="	& CF_addPSlashes ( ¶ & Tab & Tab & Tab & "Time Card" & ~s & ~q & " of " & ~n ); 		"maximum="		& ~n; 		"step="			& 1; 		"cancelable="	& If ( ~n > 1; True; False ); 	) ) ]
#  Update the inter-process timer
End If
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & "show thermometer¶" ) ]
# 
#  Loop through the IDs...
Set Variable [ $i ; Value: 1 ]
Loop [ Flush: Always ]
Exit Loop If [ not $$WebDirect and BE_GetLastError		//  1 = user pressed 'Cancel' button ]
Set Variable [ $tcd_subset ; Value: MiddleValues ( $timecard_id ; $i ; $tcd_limit ) ]
Exit Loop If [ IsEmpty ( $tcd_subset ) ]
Set Variable [ $i ; Value: $i + $tcd_limit ]
# 
# Route timecards to the correct client contract
Perform Script [ “Client Router” from file: “CurtainTime_scripting” ; Specified: From list ; Parameter: List ( 	"timeCard_id="			& CF_addPSlashes ( $tcd_subset ); 	"mode="					& CF_addPSlashes ( $mode ); 	"client="				& GLO__Globals::company_name_short_g & $staff; 	"omit_unpd="				& GetAsBoolean ( GLO__Globals::omit_unpaid_meals_g ); 	"ratings="				& GetAsBoolean ( GLO__Globals::enable_ratings_g ); 	"bill_scope_actual="		& GLO__Globals::billable_scope_actual_g; 	"bill_scope_estimate="	& GLO__Globals::billable_scope_estimate_g; 	"flat_hrs_rec="			& GetAsBoolean ( GLO__Globals::record_flat_rate_equivilent_hours_g ); ) ]
Set Variable [ $scriptResult ; Value: Let ( 	~error = Get ( LastError ); 	If ( ~error; 		List ( "error=" & ~error; "message=Error: " & ~error & " - Perform Script error" ); 		Get ( ScriptResult ) 	) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult; "message" ) ]
Set Variable [ $success_ids ; Value: CF_getProperty ( $scriptResult; "success_ids" ) ]
Set Variable [ $clearable ; Value: List ( 	$clearable; 	$success_ids; ) ]
#  If there were errors, assemble the matter into a value list for later reporting, but keep processing the Time Card list.
If [ $error ]
Set Variable [ $message_list ; Value: List ( 	$message_list; 	$message ) ]
Set Variable [ $error ; Value: 0 ]
End If
# 
#  Update the inter-process timer
Insert Calculated Result [ Target: $process_log ; Let ([ 	qty = ValueCount ( $tcd_subset ); 	plural = If ( qty > 1; "s" ); 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & "Apply Rules to " & qty & " TCD" & plural & ¶ ) ]
# 
If [ $i ≤ $tcd_total ]
If [ not CF_isDevServer ]
#  Update progress dialog
Perform Script [ “Thermometer” ; Specified: From list ; Parameter: Let ([ 	~bottom	= $i; 	~top		= Min ( $i + $tcd_limit - 1 ; $tcd_total ); 	~q		= ~bottom & If ( ~bottom < ~top; " - " & ~top ); 	~s		= If ( ~bottom < ~top; "s "; " " ); 	~tabs	= Tab & Tab & Tab; 	~errors	= ValueCount ( $message_list ); 	~err		= If ( ~errors; ¶ & ~tabs & Tab & ~errors & " error" & If ( ~errors > 1; "s" )) ]; 	List ( 		"mode="			& "Update"; 		"description="	& CF_addPSlashes ( ¶ & ~tabs & "Time Card" & ~s &  ~q & " of " & $tcd_total & ~err ); 		"step="			& $i - 1; 	) ) ]
End If
#  Update the inter-process timer
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & "update thermometer¶" ) ]
End If
End Loop
# 
If [ not CF_isDevServer ]
#  Update progress dialog
Perform Script [ “Thermometer” ; Specified: From list ; Parameter: List ( 	"mode="			& "Update"; 	"description="	& CF_addPSlashes ( ¶ & Tab & Tab & Tab & "Clean up ..." ); 	"step="			& $tcd_total; ) ]
End If
# 
If [ not $$WebDirect 	and not CF_CheckLayoutTableName ( VIL__VirtualList::__id ) ]
#  Return the user to their original layout
Go to Layout [ $originalLayout ; Animation: None ]
Go to Object [ Object Name: $original_slider ; Repetition: 1 ]
End If
# 
#  Update the inter-process timer
Insert Calculated Result [ Target: $process_log ; Let ([ 	elapsed = ( Get ( CurrentTimeUTCMilliseconds ) - $process_timer ) / 1000; 	$process_timer = Get ( CurrentTimeUTCMilliseconds ) ]; 	elapsed & Tab & "Nav back to original layout¶" ) ]
# 
#  If so directed, clear the Time Card selection(s)
If [ IsEmpty ( $clear_selection ) 	and GLO__Globals::clear_selection_after_rules_g 	and not IsEmpty ( $uncheckable ) ]
#  Since we were successful, remove the "current" timecard(s) from the list of selected IDs, which will clear the green check mark.
Set Variable [ $new_selected ; Value: CF_omitValues ( $original_selected; $clearable ) ]
Else
Set Variable [ $new_selected ; Value: $original_selected ]
End If
If [ CF_CheckLayoutTableName ( VIL__VirtualList::__id ) ]
Set Variable [ $$selectedPunchTCDs ; Value: $new_selected ]
Else
Set Field [ CLL__Call::__id_selected_g ; $new_selected ]
End If
# 
Exit Loop If [ True		//  Always exit the single-iteration control loop to prevent infinite spin!  ]
End Loop
# 
#  Cleanup steps: close worker windows, gather script results, etc...
Set Variable [ $result ; Value: List	( 	"error="		& If ( IsEmpty ( $error ); 0; $error ); 	"message="	& CF_addPSlashes ( $message_list ); ) ]
Set Variable [ $$rule_navigation ; Value: "" ]
# 
#  Make a record of this event
Perform Script [ “Create Log Entry” ; Specified: From list ; Parameter: List ( 	"action="		& "Apply Contract Rules"; 	"file_name="		& Get ( FileName ); 	"script_name="	& Get ( ScriptName ); 	"run_time="		& Round (( Get ( CurrentTimeUTCMilliseconds ) - $startTime ) / 1000; 3 ); 	"error="			& $error; 	"parameters="	& CF_addPSlashes ( 						List ( 							"mode="				& CF_addPSlashes ( $mode ); 							"psos="				& If ( $psos; "True"; "False" ); 							"timecard_count="	& ValueCount ( $timecard_id ); 							"timeCard_id="		& CF_addPSlashes ( $timeCard_id ) 						) 					); 	"results="		& CF_addPSlashes ( $result ); 	"notes="			& CF_addPSlashes ( CF_Trim4 ( $process_log )); ) ]
# 
If [ not CF_isDevServer ]
#  Clear the progress dialog
Perform Script [ “Thermometer” ; Specified: From list ; Parameter: "mode=Clear" ]
End If
# 
#  Re-enable BrowserNav
Set Variable [ $$BrowserNav ; Value: JSONFormatElements ( JSONDeleteElement ( $$BrowserNav ; "disabled" )) ]
# 
#  Inform the user of any errors encountered/generated.
If [ $error > 0 	or Length ( $message_list ) ]
Perform Script [ “Dialog Show” ; Specified: From list ; Parameter: List ( 	"type=" 		& "error";		//	info, warning, error 	"size="		& Case ( ValueCount ( $message_list ) > 2; "large"; "small" ); 	"title="		& "Error"; 	"message="	& CF_addPSlashes ( $message_list ); 	"error="		& If ( $error and $error ≠ 1; $error ); 	"button1="	& "OK"; 	"button2="	& ""; 	"button3="	& ""; 	"modal="		& False; ) ]
Else
Set Field [ GLO__Globals::zRefresh_g ; not GLO__Globals::zRefresh_g ]
End If
# 
#  Restore the error capture and user abort states.
If [ $userAbortOn ]
Allow User Abort [ On ]
End If
If [ not $errorCaptureOn ]
Set Error Capture [ Off ]
End If
# 
#  That's it - exit script!
Exit Script [ Text Result: True			//  We always return something  ]
# 

```
