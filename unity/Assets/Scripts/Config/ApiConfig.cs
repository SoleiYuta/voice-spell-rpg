using UnityEngine;

[CreateAssetMenu(fileName = "ApiConfig", menuName = "AiGrimoire/ApiConfig")]
public class ApiConfig : ScriptableObject
{
    public bool useMock = true;
    public string apiBaseUrl = "http://localhost:8080";
}
