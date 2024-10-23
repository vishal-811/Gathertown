
export interface userDetailsType{
    username : string,
    session : string,
    password?: string | number
}

export interface usersType {
   [userId : string] : userDetailsType
}

export interface roomsType{
    [roomId : string] : string
}